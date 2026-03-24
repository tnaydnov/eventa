const fs = require('fs');

const files = [
  'src/app/privacy/PrivacyContent.tsx',
  'src/app/terms/TermsContent.tsx',
];

for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');

  // Compound style override (last section, marginBottom: 0)
  c = c.replace(
    /style=\{\{\s*\.\.\.sectionStyle,\s*marginBottom:\s*0\s*\}\}/g,
    'className="legal-section"'
  );

  // Simple style references
  c = c.replace(/ style=\{sectionStyle\}/g, ' className="legal-section"');
  c = c.replace(/ style=\{headingStyle\}/g, ' className="legal-heading"');
  c = c.replace(/ style=\{subHeadingStyle\}/g, ' className="legal-subheading"');
  c = c.replace(/ style=\{textStyle\}/g, ' className="legal-text"');
  c = c.replace(/ style=\{listStyle\}/g, ' className="legal-list"');
  c = c.replace(/ style=\{boldText\}/g, ' className="legal-text legal-text--bold"');
  c = c.replace(/ style=\{linkColor\}/g, ' className="legal-link"');
  c = c.replace(/ style=\{liStyle\}/g, '');

  fs.writeFileSync(f, c, 'utf8');

  const remaining = (c.match(/style=/g) || []).length;
  console.log(`${f}: done (remaining style= occurrences: ${remaining})`);
}
