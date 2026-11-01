// Narration for every state. Short, plain, one idea at a time.

import { FLOW_STAGES } from '../scenario/issuance.js';
import { STEPS } from '../state/machine.js';

export const OPENING = Object.freeze({
  question: 'How did all of these fields come together?',
  caption: 'This certificate looks like a block of encoded data. Inside it is a complete identity, public key, policy result, trust path, and signature.',
});

export function captionFor(state) {
  const step = STEPS[state.step];
  if (state.scene === 'compare') {
    return {
      title: 'Compare CSR and certificate',
      text: 'Left: what APP01 asked for. Right: what the Issuing CA issued. Lines show where a certificate field came from; stubs mark fields with no CSR source. Select any field to trace it.',
    };
  }
  if (state.scene === 'flow') {
    const st = FLOW_STAGES[state.flowStage];
    return { title: `${step.title}: ${st.title}`, text: st.caption };
  }
  if (state.encoding && state.encoding !== 'structure') {
    return {
      title: 'Encoding',
      text: 'The block of letters and numbers is not a different object. It is this exact structure, written out as bytes and then as text. Each colour is one structure from the exploded view.',
    };
  }
  if (state.scene === 'cert') {
    if (!state.cert.exploded) return { title: step.title, text: OPENING.caption };
    if (state.step === 2) {
      return {
        title: step.title,
        text: 'Each field is coloured by where it came from. Only some came from the request. The CA chose, derived or configured the rest. Select a colour to isolate it, or a field to trace it.',
      };
    }
    if (!state.cert.open.length) {
      return {
        title: step.title,
        text: 'Three layers: the signed body, the algorithm, and the CA signature. Select TBSCertificate to open the fields the Issuing CA vouched for.',
      };
    }
    return {
      title: step.title,
      text: 'Select a layer to open it, or a field to read what it is, who set it and how it is checked. Escape steps back one level.',
    };
  }
  if (state.scene === 'csr') {
    if (!state.csr.exploded) {
      return {
        title: step.title,
        text: 'This is the request APP01 created before any certificate existed. It is also encoded data, signed by APP01 itself. The private key on the left never joins it.',
      };
    }
    return {
      title: step.title,
      text: 'A CSR has three layers: the signed request body, the algorithm, and APP01\'s own signature. The private key stays outside, on APP01. Open the layers and select any field.',
    };
  }
  return { title: step.title, text: '' };
}
