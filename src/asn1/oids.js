// Object identifiers used by the Certificate Anatomy fixtures.
// Only identifiers that actually appear in the generated artifacts are listed.

export const OID = Object.freeze({
  rsaEncryption: '1.2.840.113549.1.1.1',
  sha256WithRSAEncryption: '1.2.840.113549.1.1.11',
  commonName: '2.5.4.3',
  organizationName: '2.5.4.10',
  extensionRequest: '1.2.840.113549.1.9.14',
  enrollmentNameValuePair: '1.3.6.1.4.1.311.13.2.1',
  subjectAltName: '2.5.29.17',
  keyUsage: '2.5.29.15',
  extKeyUsage: '2.5.29.37',
  basicConstraints: '2.5.29.19',
  subjectKeyIdentifier: '2.5.29.14',
  authorityKeyIdentifier: '2.5.29.35',
  authorityInfoAccess: '1.3.6.1.5.5.7.1.1',
  cRLDistributionPoints: '2.5.29.31',
  cRLNumber: '2.5.29.20',
  serverAuth: '1.3.6.1.5.5.7.3.1',
  caIssuers: '1.3.6.1.5.5.7.48.2',
});

export const OID_NAMES = Object.freeze({
  [OID.rsaEncryption]: 'rsaEncryption',
  [OID.sha256WithRSAEncryption]: 'sha256WithRSAEncryption',
  [OID.commonName]: 'CN',
  [OID.organizationName]: 'O',
  [OID.extensionRequest]: 'Extension Request',
  [OID.enrollmentNameValuePair]: 'Enrollment Name-Value Pair',
  [OID.subjectAltName]: 'Subject Alternative Name',
  [OID.keyUsage]: 'Key Usage',
  [OID.extKeyUsage]: 'Enhanced Key Usage',
  [OID.basicConstraints]: 'Basic Constraints',
  [OID.subjectKeyIdentifier]: 'Subject Key Identifier',
  [OID.authorityKeyIdentifier]: 'Authority Key Identifier',
  [OID.authorityInfoAccess]: 'Authority Information Access',
  [OID.cRLDistributionPoints]: 'CRL Distribution Points',
  [OID.cRLNumber]: 'CRL Number',
  [OID.serverAuth]: 'Server Authentication',
  [OID.caIssuers]: 'CA Issuers',
});

/** Key Usage bit positions (RFC 5280 4.2.1.3). */
export const KEY_USAGE_BITS = Object.freeze([
  'Digital Signature',
  'Non-Repudiation',
  'Key Encipherment',
  'Data Encipherment',
  'Key Agreement',
  'Certificate Signing',
  'CRL Signing',
  'Encipher Only',
  'Decipher Only',
]);

export function oidName(oid) {
  return OID_NAMES[oid] || oid;
}
