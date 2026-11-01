import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nodeContext, ROOT } from '../helpers/context.js';
import { FLOW_STAGES, FLOW_STAGE_IDS, ACTORS, LEARNING_NOTE, VERIFICATION_CHECKS, EVALUATION_CHECKS } from '../../src/scenario/issuance.js';
import { SCENARIO } from '../../src/scenario/scenario.js';
import { FILM, CAPTIONS, TITLE_CARDS, buildShots, transitionWindows, frameAt, overlayOpacity } from '../../src/film/timeline.js';

describe('manual issuance stages', () => {
  it('run in the required order', () => {
    expect(FLOW_STAGE_IDS).toEqual(['created', 'submitted', 'evaluated', 'issued', 'returned', 'installed', 'matched', 'verified']);
  });
  it('never include the Root CA as a participant', () => {
    for (const s of FLOW_STAGES) expect(s.participants).not.toContain('root');
    expect(ACTORS.root.does).toMatch(/no part/i);
  });
  it('keep the private key on APP01 throughout', () => {
    for (const s of FLOW_STAGES) expect(s.keyAt).toBe('app');
  });
  it('create the CSR on APP01, evaluate before issuing, and return the certificate to APP01', () => {
    const by = Object.fromEntries(FLOW_STAGES.map((s) => [s.id, s]));
    expect(by.created.csrAt).toBe('app');
    expect(by.submitted.csrAt).toBe('ca');
    expect(by.evaluated.certAt).toBeNull();
    expect(by.issued.certAt).toBe('ca');
    expect(by.returned.certAt).toBe('app');
    expect(by.installed.certAt).toBe('store');
  });
  it('install into Local Computer > Personal > Certificates', () => {
    expect(SCENARIO.store).toEqual(['Certificates (Local Computer)', 'Personal', 'Certificates']);
  });
  it('label every command as never executed', () => {
    expect(LEARNING_NOTE).toBe('Shown for learning; never executed by this simulator.');
    for (const s of FLOW_STAGES) if (s.command) expect(s.command.text).toMatch(/^cert(req|util)/);
  });
  it('never say the CA signs the CSR', () => {
    const text = JSON.stringify([FLOW_STAGES, EVALUATION_CHECKS, VERIFICATION_CHECKS]);
    expect(text).not.toMatch(/sign(s|ed|ing)? the CSR/i);
  });
  it('verify every required property', () => {
    expect(VERIFICATION_CHECKS.map((c) => c.id)).toEqual(
      ['key', 'publicKey', 'subject', 'san', 'eku', 'ku', 'validity', 'issuer', 'signature', 'chain', 'trust', 'revocation']);
  });
});

describe('film timeline', () => {
  const ctx = nodeContext();
  const shots = buildShots(ctx);
  it('targets 45-75 s at 1920x1080, 60 fps', () => {
    expect(FILM.duration).toBeGreaterThanOrEqual(45);
    expect(FILM.duration).toBeLessThanOrEqual(75);
    expect([FILM.width, FILM.height, FILM.fps]).toEqual([1920, 1080, 60]);
  });
  it('has no overlapping shots: each transition finishes before the next begins', () => {
    const w = transitionWindows(shots);
    for (let i = 1; i < w.length; i++) {
      expect(w[i].start).toBeGreaterThan(w[i - 1].start);
      if (i + 1 < w.length) expect(w[i].end).toBeLessThan(w[i + 1].start);
    }
    expect(w[w.length - 1].end).toBeLessThan(FILM.duration);
  });
  it('covers the required story beats in order', () => {
    const labels = shots.map((s) => s.label).join('|');
    for (const beat of ['Certificate explodes', 'SAN inspected', 'Signature inspected', 'Trace to CSR', 'CSR explodes',
      'Public key, private key stays', 'CSR submitted', 'New certificate signed', 'Certificate returned', 'Private key matched',
      'Verified', 'Certificate reassembles']) expect(labels).toContain(beat);
  });
  it('has captions inside the film, non-overlapping and long enough to read', () => {
    const all = [...CAPTIONS].sort((a, b) => a.start - b.start);
    for (let i = 0; i < all.length; i++) {
      expect(all[i].end).toBeLessThanOrEqual(FILM.duration);
      expect(all[i].end - all[i].start).toBeGreaterThanOrEqual(1.9);
      if (i) expect(all[i].start).toBeGreaterThanOrEqual(all[i - 1].end);
      const words = all[i].text.split(/\s+/).length;
      expect(words / (all[i].end - all[i].start), all[i].title).toBeLessThanOrEqual(5 + 1e-9); // readable pace
    }
    expect(TITLE_CARDS[0].start).toBe(0);
  });
  it('renders each frame as a pure function of time', () => {
    expect(frameAt(44.1, shots, ctx)).toEqual(frameAt(44.1, shots, ctx));
    expect(frameAt(0, shots, ctx)).toEqual(frameAt(0, shots, ctx));
    expect(overlayOpacity(CAPTIONS[0], CAPTIONS[0].start + 1)).toBe(1);
  });
  it('ends with the certificate reassembled exactly as it began', () => {
    const start = frameAt(0, shots, ctx);
    const end = frameAt(FILM.duration, shots, ctx);
    expect(end.els.cert).toEqual(start.els.cert);
    expect(end.cam).toEqual(start.cam);
  });
  it('writes to the versioned output paths', () => {
    expect(FILM.video).toBe('output/certificate-anatomy-v0.1.0.mp4');
    expect(FILM.contactSheet).toBe('output/certificate-anatomy-v0.1.0-contact-sheet.jpg');
  });
});

describe('public deployment', () => {
  it('builds with the GitHub Pages repository base path', () => {
    const cfg = readFileSync(join(ROOT, 'vite.config.js'), 'utf8');
    expect(cfg).toContain("'/Certificate-Anatomy/'");
  });
  it('keeps generated media out of Git', () => {
    const gi = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    for (const p of ['output/*', 'dist/', '*.lnk', '*.pfx', '*.p12', '*.key']) expect(gi).toContain(p);
  });
});
