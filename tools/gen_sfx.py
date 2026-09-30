#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Artisaweb BV
#
# Procedural sound-effect generator for the game. Every sound is built from
# scratch out of oscillators, seeded noise and formant resonators — no samples,
# no ML models, no datasets — so the generated WAVs are original content under
# the repo's MIT license. Written with Claude.
#
# Usage:   python3 tools/gen_sfx.py            (needs only numpy)
# Output:  public/audio/*.wav  (44.1 kHz, 16-bit, mono)

import os
import wave

import numpy as np

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
rng = np.random.default_rng(1337)  # fixed seed -> byte-identical output every run


# ---------------------------------------------------------------- primitives

def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def phase(freq):
    """Integrate a per-sample frequency array into phase (radians)."""
    return 2 * np.pi * np.cumsum(freq) / SR


def square(freq, duty=0.5):
    return np.where((phase(freq) / (2 * np.pi)) % 1.0 < duty, 1.0, -1.0)


def saw(freq):
    return 2 * ((phase(freq) / (2 * np.pi)) % 1.0) - 1


def env_adsr(n, a, d, s, r):
    """Linear ADSR envelope; a/d/r in seconds, s = sustain level."""
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    hold = max(n - a - d - r, 0)
    e = np.concatenate([
        np.linspace(0, 1, a, endpoint=False),
        np.linspace(1, s, d, endpoint=False),
        np.full(hold, s),
        np.linspace(s, 0, r),
    ])
    return np.pad(e, (0, max(n - len(e), 0)))[:n]


def exp_decay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lowpass(x, cutoff):
    """One-pole lowpass; cutoff may be a scalar or per-sample array."""
    cutoff = np.broadcast_to(cutoff, x.shape)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def resonator(x, freq, bw):
    """Klatt 2-pole resonator. freq/bw may vary per sample and it stays stable,
    which is what makes gliding formants (the 'g' -> 'a' of "gah") work."""
    freq = np.broadcast_to(freq, x.shape)
    bw = np.broadcast_to(bw, x.shape)
    C = -np.exp(-2 * np.pi * bw / SR)
    B = 2 * np.exp(-np.pi * bw / SR) * np.cos(2 * np.pi * freq / SR)
    A = 1 - B - C
    y = np.empty_like(x)
    y1 = y2 = 0.0
    for i in range(len(x)):
        y0 = A[i] * x[i] + B[i] * y1 + C[i] * y2
        y[i] = y0
        y2, y1 = y1, y0
    return y


def glottal(f0, jitter=0.0, shimmer=0.0):
    """Glottal pulse train (Rosenberg-ish shape) with optional pitch jitter and
    amplitude shimmer, the two things that stop a synthetic voice sounding
    like a pure buzzer."""
    n = len(f0)
    if jitter:
        f0 = f0 * (1 + jitter * lowpass(rng.standard_normal(n), 40) * 4)
    p = (phase(f0) / (2 * np.pi)) % 1.0
    open_q = 0.6
    pulse = np.where(p < open_q, 0.5 * (1 - np.cos(np.pi * p / open_q)),
                     np.cos(np.pi / 2 * (p - open_q) / (1 - open_q)))
    src = np.diff(pulse, prepend=0.0)  # radiated-flow derivative: more vocal
    if shimmer:
        src *= 1 + shimmer * lowpass(rng.standard_normal(n), 30) * 4
    return src


def formants(src, tracks):
    """Cascade resonators. tracks = [(freq, bw), ...], each scalar or array."""
    y = src
    for f, bw in tracks:
        y = resonator(y, f, bw)
    return y


def glide(n, *points):
    """Piecewise-linear curve through (time_fraction, value) points."""
    xs, ys = zip(*points)
    return np.interp(np.linspace(0, 1, n), xs, ys)


def noise(n):
    return rng.uniform(-1, 1, n)


def ring_mod(x, freq, mix):
    """The 'robot' in the voice: blend in a ring-modulated copy."""
    carrier = np.sin(2 * np.pi * freq * np.arange(len(x)) / SR)
    return (1 - mix) * x + mix * x * carrier


def bitcrush(x, bits, keep_every=1):
    q = 2 ** (bits - 1)
    y = np.round(x * q) / q
    if keep_every > 1:  # sample-and-hold downsample
        y = np.repeat(y[::keep_every], keep_every)[:len(x)]
    return y


def place(buf, clip, at):
    """Mix clip into buf starting at `at` seconds, growing buf if needed."""
    start = int(at * SR)
    end = start + len(clip)
    if end > len(buf):
        buf = np.pad(buf, (0, end - len(buf)))
    buf[start:end] += clip
    return buf


# ------------------------------------------------------------ building blocks

def crackle(dur, density, tone=3000):
    """Electrical fizz: sparse random pops over a hiss bed."""
    n = int(dur * SR)
    pops = (rng.random(n) < density / SR) * rng.uniform(-1, 1, n)
    pops = resonator(pops, tone, 1500) * 6
    hiss = highpass(noise(n), 4000) * 0.15
    return pops + hiss


def thud(dur=0.45, f_start=110, f_end=38, weight=1.0):
    """Body-hits-floor: pitch-dropping sine + short low noise transient."""
    n = int(dur * SR)
    f = glide(n, (0, f_start), (0.25, f_end * 1.3), (1, f_end))
    body = np.sin(phase(f)) * exp_decay(n, 0.12 * weight)
    click = lowpass(noise(n), 900) * exp_decay(n, 0.012) * 2.5
    return body + click


def metal_clank(dur=0.5, base=310):
    """Inharmonic partials = sounds like a hollow metal shell being hit."""
    t = t_axis(dur)
    ratios = [1.0, 2.76, 5.40, 8.93]
    out = sum(np.sin(2 * np.pi * base * r * t) / (i + 1) * np.exp(-t * (6 + 5 * i))
              for i, r in enumerate(ratios))
    return out


def liquid_pour(dur=0.85):
    """Beer going into a glass. The trick is that the resonant band *climbs*
    over the pour: the air column above the liquid gets shorter as the glass
    fills, which is the cue that makes it read as filling rather than as
    generic running water. Bubbles ride the same curve an octave up."""
    n = int(dur * SR)
    f = glide(n, (0, 420), (1, 1150))
    # The noise bed is lowpassed *before* the resonator and the resonator is
    # narrow: a wide band here just reads as tap hiss, and the climbing
    # resonance — the whole point — gets buried under it.
    body = resonator(lowpass(noise(n), 2200), f, 240) * 5.0
    splash = highpass(lowpass(noise(n), 5200), 2600) * 0.10
    bubbles = (rng.random(n) < 70 / SR) * rng.uniform(0.3, 1.0, n)
    bubbles = resonator(bubbles, f * 2.2, 170) * 3.0
    return (body + splash + bubbles) * glide(n, (0, 0), (0.05, 1), (0.85, 1), (1, 0))


def creak(dur, rate_start, rate_end, pitch=900):
    """Rusty-hinge friction: a train of tiny resonant clicks whose rate wanders
    (stick-slip), like a joint that hasn't been oiled since 2019."""
    n = int(dur * SR)
    rate = glide(n, (0, rate_start), (0.5, (rate_start + rate_end) / 2 * 1.4), (1, rate_end))
    rate *= 1 + 0.35 * lowpass(rng.standard_normal(n), 8) * 4
    impulses = np.zeros(n)
    ph = np.cumsum(rate) / SR
    impulses[1:][np.diff(np.floor(ph)) > 0] = 1.0
    impulses *= rng.uniform(0.4, 1.0, n)
    tone = pitch * (1 + 0.2 * np.sin(2 * np.pi * 1.3 * t_axis(dur)))
    return resonator(impulses, tone, 120) * 0.6 + resonator(impulses, tone * 2.3, 200) * 0.3


# -------------------------------------------------------------------- sounds

def sfx_pickup():
    # Bright rising square-wave arpeggio: C6 E6 G6 C7.
    notes = [1046.5, 1318.5, 1568.0, 2093.0]
    step = 0.055
    out = np.zeros(1)
    for i, f in enumerate(notes):
        n = int(step * SR * (2.2 if i == len(notes) - 1 else 1.0))
        tone = square(np.full(n, f), duty=0.25) * env_adsr(n, 0.002, 0.03, 0.5, 0.02)
        out = place(out, tone * 0.5, i * step)
    return out


def sfx_hit():
    # Crunchy impact: noise burst + square that dives from 420 Hz to 70 Hz.
    n = int(0.3 * SR)
    f = glide(n, (0, 420), (0.4, 110), (1, 70))
    body = square(f, 0.4) * exp_decay(n, 0.08)
    burst = lowpass(noise(n), 2500) * exp_decay(n, 0.025)
    return bitcrush(body * 0.6 + burst, 6, keep_every=2)


def sfx_stun():
    # Cartoon "seeing stars": a few warbling triangle-ish chirps.
    dur = 0.9
    n = int(dur * SR)
    t = t_axis(dur)
    f = 1500 + 450 * np.sin(2 * np.pi * 7 * t) - 500 * t
    tone = np.abs(saw(f)) * 2 - 1
    am = 0.5 + 0.5 * np.sin(2 * np.pi * 5 * t - np.pi / 2)
    return tone * am * env_adsr(n, 0.01, 0.1, 0.8, 0.3) * 0.5


def sfx_timer_low():
    # One "beep-boop" tick; the game plays it once per second when time is low.
    seg = int(0.09 * SR)
    hi = square(np.full(seg, 988.0), 0.5) * env_adsr(seg, 0.002, 0.02, 0.7, 0.02)
    lo = square(np.full(seg, 740.0), 0.5) * env_adsr(seg, 0.002, 0.02, 0.7, 0.03)
    out = np.concatenate([hi, np.zeros(int(0.03 * SR)), lo])
    return lowpass(out, 5000) * 0.5


def sfx_energy_empty():
    # Power-down: sine sweep 700 -> 60 Hz with a slowing wobble, then a sputter.
    dur = 1.1
    n = int(dur * SR)
    t = t_axis(dur)
    f = 700 * np.exp(-t * 2.4) + 55
    f *= 1 + 0.06 * np.sin(2 * np.pi * (9 - 6 * t) * t)
    tone = (np.sin(phase(f)) + 0.35 * square(f, 0.3)) * env_adsr(n, 0.005, 0.1, 0.8, 0.35)
    sputter = crackle(0.35, 60, tone=1200) * exp_decay(int(0.35 * SR), 0.1) * 0.5
    return place(tone * 0.6, sputter, 0.75)


def vowel_gah():
    """Startled 'gah!' — velar burst, F2/F3 pinch opening into /a/, pitch that
    jumps up in surprise and falls off."""
    dur = 0.42
    n = int(dur * SR)
    f0 = glide(n, (0, 260), (0.12, 430), (0.45, 380), (1, 250))
    src = glottal(f0, jitter=0.01, shimmer=0.08)
    f1 = glide(n, (0, 300), (0.15, 780), (1, 720))
    f2 = glide(n, (0, 1850), (0.15, 1300), (1, 1220))
    f3 = glide(n, (0, 2100), (0.15, 2600), (1, 2600))
    v = formants(src, [(f1, 90), (f2, 110), (f3, 160), (3500, 250)])
    v *= env_adsr(n, 0.015, 0.1, 0.8, 0.18)
    burst = resonator(noise(int(0.018 * SR)), 1900, 600) * np.linspace(1, 0, int(0.018 * SR))
    v /= np.max(np.abs(v))
    return place(v, burst * 0.6, 0.0)


def sfx_voxxy_shortcircuit():
    # Crackle starts first (the cold drink hits), yelp lands on top of it.
    buzz = crackle(0.9, 900) * exp_decay(int(0.9 * SR), 0.35)
    zap = square(np.full(int(0.9 * SR), 120.0), 0.5) * exp_decay(int(0.9 * SR), 0.2) * 0.15
    out = buzz + zap
    yelp = ring_mod(vowel_gah(), 55, 0.35)
    yelp = bitcrush(yelp, 8)
    return place(out * 0.35, yelp, 0.06)


def groan(dur=1.3):
    """Old-man 'uhhh-ohhh' getting up: low, rough, sagging into vocal fry."""
    n = int(dur * SR)
    f0 = glide(n, (0, 105), (0.35, 128), (0.8, 92), (1, 70))
    src = glottal(f0, jitter=0.03, shimmer=0.2)
    # Vocal fry at the tail: gate the pulses so they come through irregularly.
    fry_gate = glide(n, (0, 1), (0.7, 1), (1, 0))
    gate = np.where(rng.random(n) < 0.35, 1.0, 0.3)
    src *= fry_gate + (1 - fry_gate) * lowpass(gate, 60)
    f1 = glide(n, (0, 520), (0.5, 560), (1, 450))
    f2 = glide(n, (0, 1400), (0.5, 1050), (1, 850))
    f3 = glide(n, (0, 2450), (1, 2400))
    v = formants(src, [(f1, 110), (f2, 130), (f3, 190)])
    breath = formants(noise(n) * 0.02, [(f1, 300), (f2, 400)])
    v = (v + breath) * env_adsr(n, 0.12, 0.2, 0.85, 0.35)
    return v / np.max(np.abs(v))


def sfx_droid_getup():
    out = ring_mod(groan(1.3), 40, 0.25)
    joint = creak(1.1, 18, 45) * env_adsr(int(1.1 * SR), 0.05, 0.1, 0.9, 0.2)
    joint /= np.max(np.abs(joint))
    out = place(out * 0.8, joint * 0.45, 0.25)
    # The knee finally clicks into place: two sharp ticks, then done.
    n = int(0.15 * SR)
    ticks = np.zeros(n)
    ticks[[0, int(0.07 * SR)]] = [1.0, 0.7]
    pop = resonator(ticks, 1400, 150) + resonator(ticks, 3200, 300) * 0.5
    return place(out, pop / np.max(np.abs(pop)) * 0.7, 1.3)


def sfx_droid_thud():
    # Topple impact: tall hollow robot hits carpet.
    return place(thud(0.5, 140, 45) * 0.8, metal_clank(0.6, 280) * 0.45, 0.005)


def vowel_oof():
    """'OOF' — winded /u/ with a sharp onset, closing into an 'f' hiss."""
    dur_v, dur_f = 0.26, 0.16
    n = int(dur_v * SR)
    f0 = glide(n, (0, 170), (0.2, 150), (1, 105))
    src = glottal(f0, jitter=0.015, shimmer=0.12)
    f1 = glide(n, (0, 450), (1, 320))
    f2 = glide(n, (0, 1000), (1, 850))
    v = formants(src, [(f1, 90), (f2, 110), (2300, 170)])
    v *= env_adsr(n, 0.008, 0.06, 0.8, 0.07)
    v /= np.max(np.abs(v))
    nf = int(dur_f * SR)
    f = highpass(noise(nf), 2500) * env_adsr(nf, 0.02, 0.03, 0.6, 0.1) * 0.3
    return place(v, f, dur_v - 0.05)


def sfx_biggy_fall():
    # The OOF comes as he hits; then the big heavy body settles.
    voice = bitcrush(ring_mod(vowel_oof(), 60, 0.3), 8)
    # f_end stays above ~50 Hz so laptop speakers still reproduce the weight.
    body = thud(0.9, 160, 55, weight=2.2) * 0.55
    wobble_n = int(0.5 * SR)
    wobble = np.sin(phase(np.full(wobble_n, 90.0))) * np.sin(2 * np.pi * 9 * t_axis(0.5)) \
        * exp_decay(wobble_n, 0.15) * 0.35  # the belly jiggle
    out = place(voice, body, 0.24)
    return place(out, wobble, 0.38)


def sfx_duck_squeak():
    # A squeeze toy is air forced through a reed: a narrow, strongly-resonant
    # band with a pitch that rises on the squeeze and falls as it springs back,
    # plus the breathy hiss of the air itself. Two squeaks, the second smaller,
    # which is what a duck actually does when you stand on it and step off.
    def squeak(dur, f_lo, f_hi, level):
        n = int(dur * SR)
        f = glide(n, (0, f_lo), (0.35, f_hi), (1, f_lo * 0.85))
        reed = saw(f) * 0.6 + square(f, 0.3) * 0.4
        voiced = formants(reed, [(f * 2.1, 220), (f * 4.3, 500)])
        air = highpass(lowpass(noise(n), 6000), 1800) * 0.12
        return (voiced + air) * glide(n, (0, 0), (0.08, 1), (0.7, 0.9), (1, 0)) * level

    out = np.zeros(1)
    out = place(out, squeak(0.26, 620, 1150, 1.0), 0.0)
    out = place(out, squeak(0.19, 540, 900, 0.55), 0.30)
    return out


def sfx_coffee_pour():
    # Pump hum, then the shot itself. Same climbing-resonance trick as the beer
    # pour, an octave up and much shorter — a cup, not a pint — then a ceramic
    # tick as it's set down.
    out = np.zeros(1)
    n_h = int(0.35 * SR)
    hum = np.sin(phase(np.full(n_h, 96.0))) * 0.6 + saw(np.full(n_h, 48.0)) * 0.3
    out = place(out, lowpass(hum, 1200) * env_adsr(n_h, 0.04, 0.05, 0.85, 0.12) * 0.5, 0.0)
    n_s = int(0.55 * SR)
    f = glide(n_s, (0, 900), (1, 1800))
    stream = resonator(lowpass(noise(n_s), 4000), f, 320) * 4.0
    out = place(out, stream * glide(n_s, (0, 0), (0.08, 1), (0.8, 1), (1, 0)), 0.28)
    out = place(out, metal_clank(0.18, base=1400) * 0.35, 0.86)
    return out


def sfx_candy_drop():
    # Spiral coil turning, wrapper crinkle as the bar tips, thunk in the tray.
    out = np.zeros(1)
    n_m = int(0.42 * SR)
    whirr = saw(glide(n_m, (0, 210), (0.2, 250), (1, 230)))
    out = place(out, lowpass(whirr, 2200) * env_adsr(n_m, 0.03, 0.06, 0.8, 0.1) * 0.45, 0.0)
    n_c = int(0.30 * SR)
    crinkle = (rng.random(n_c) < 900 / SR) * rng.uniform(-1, 1, n_c)
    crinkle = highpass(resonator(crinkle, 4200, 2500), 2000) * 5.0
    out = place(out, crinkle * exp_decay(n_c, 0.12), 0.34)
    out = place(out, thud(0.30, 240, 90, 0.7) * 0.9 + metal_clank(0.30, base=680) * 0.25, 0.52)
    return out


def sfx_charge_up():
    # The charging pad. Unlike the two kiosks this is a *sustained* action — you
    # stand on it and energy accrues — so the sound has to read as "charging
    # started and completed" rather than as a single grab: a power hum climbing
    # an octave and a half with electrical shimmer over it, resolving into a
    # confirmation chime.
    dur = 1.0
    n = int(dur * SR)
    f = glide(n, (0, 110), (0.75, 300), (1, 330))
    core = saw(f) * 0.5 + saw(f * 1.005) * 0.5  # detuned pair = a beating hum
    core = lowpass(core, glide(n, (0, 900), (1, 4200)))
    # Shimmer sits well under the hum and in a narrow band: mixed any louder it
    # swamps the climb entirely and the whole thing reads as hiss, not power.
    shimmer = resonator(crackle(dur, 140, tone=5200), glide(n, (0, 2500), (1, 6000)), 400) * 1.5
    out = (core * 2.4 + shimmer * 0.16) * glide(n, (0, 0), (0.06, 1), (0.8, 1), (1, 0))
    n_c = int(0.45 * SR)
    chime = sum(np.sin(2 * np.pi * fr * t_axis(0.45)) / (i + 1)
                for i, fr in enumerate([1568.0, 2093.0, 3136.0]))
    return place(out, chime * exp_decay(n_c, 0.13) * 0.8, 0.82)


def sfx_beer_pour():
    # Tap handle, pour, foam settling. Every robot gets this one; Biggy gets
    # the burp below on top of it.
    out = np.zeros(1)
    out = place(out, metal_clank(0.16, base=540) * 0.45, 0.0)
    out = place(out, liquid_pour(0.85), 0.07)
    # Foam settling. Two passes of the one-pole lowpass, not one: a single pole
    # rolls off at only 6 dB/oct, so a nominal 3 kHz cut still leaves enough
    # 8-10 kHz content for the tail to read as tape hiss rather than as foam.
    n_foam = int(0.35 * SR)
    foam = lowpass(lowpass(noise(n_foam), 3000), 3000)
    foam = highpass(foam, 800) * exp_decay(n_foam, 0.16) * 0.55
    out = place(out, foam, 0.86)
    return out


def sfx_biggy_burp():
    # Played after the pour, for Biggy only (the user: "especially when it is
    # Biggy, a burp is allowed"). A burp is a very low, flutter-modulated
    # glottal source through a back vowel whose mouth closes as it runs out —
    # so F1/F2 both fall — with a wet rasp layered on. Ring-modulated at the
    # end like every other vocal in this file: these are robots, and a
    # *robotic* rendering of a human noise fits the joke better than an
    # attempt at a real one.
    dur = 0.75
    n = int(dur * SR)
    f0 = glide(n, (0, 95), (0.2, 78), (0.7, 66), (1, 58))
    f0 = f0 * (1 + 0.10 * np.sin(2 * np.pi * 22 * t_axis(dur)))  # the flutter
    src = glottal(f0, jitter=0.03, shimmer=0.25)
    voice = formants(src, [
        (glide(n, (0, 560), (1, 430)), 110),
        (glide(n, (0, 1000), (1, 900)), 180),
        (2600, 400),
    ])
    rasp = resonator(noise(n) * (rng.random(n) < 900 / SR), 300, 200) * 1.2
    envl = glide(n, (0, 0), (0.03, 1), (0.6, 0.85), (1, 0))
    return ring_mod((voice * 3 + rasp) * envl, 70, 0.3)


SOUNDS = {
    "pickup": sfx_pickup,
    "hit": sfx_hit,
    "stun": sfx_stun,
    "timer-low": sfx_timer_low,
    "energy-empty": sfx_energy_empty,
    "voxxy-shortcircuit": sfx_voxxy_shortcircuit,
    "droid-getup": sfx_droid_getup,
    "droid-thud": sfx_droid_thud,
    "biggy-fall": sfx_biggy_fall,
    "beer-pour": sfx_beer_pour,
    "biggy-burp": sfx_biggy_burp,
    "coffee-pour": sfx_coffee_pour,
    "candy-drop": sfx_candy_drop,
    "charge-up": sfx_charge_up,
    "duck-squeak": sfx_duck_squeak,
}


# --------------------------------------------------------------------- output

def finalize(x):
    x = highpass(x, 45)  # resonators leave DC/sub rumble no speaker can play
    fade = int(0.005 * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    peak = np.max(np.abs(x))
    assert np.isfinite(x).all() and peak > 0
    return x / peak * 10 ** (-1 / 20)  # normalize to -1 dBFS


def write_wav(path, x):
    pcm = np.clip(np.round(x * 32767), -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, build in SOUNDS.items():
        x = finalize(build().astype(np.float64))
        path = os.path.join(OUT_DIR, f"{name}.wav")
        write_wav(path, x)
        print(f"{name:20s} {len(x) / SR:5.2f}s  peak {20 * np.log10(np.max(np.abs(x))):5.1f} dBFS")


if __name__ == "__main__":
    main()
