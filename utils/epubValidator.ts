import JSZip from 'jszip';

interface ManifestItem {
  href: string;
  mediaType: string;
}

export interface EPUBValidationResult {
  isValid: boolean;
  issues: string[];
  opfPath?: string;
  opfContent?: string;
  manifestItems?: Map<string, ManifestItem>;
}

export const validateEpub = async (zip: JSZip): Promise<EPUBValidationResult> => {
  const issues: string[] = [];

  // Check mimetype
  const mimetypeFile = zip.file('mimetype');
  if (!mimetypeFile) {
    issues.push('Missing mimetype file');
  } else {
    const mimetype = await mimetypeFile.async('text');
    if (mimetype.trim() !== 'application/epub+zip') {
      issues.push('Invalid mimetype - must be application/epub+zip');
    }
  }

  // Find OPF file
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) {
    issues.push('Missing container.xml');
    return { isValid: false, issues };
  }

  const opfPathMatch = containerXml.match(/<rootfile[^>]+full-path="([^"]+)"/);
  if (!opfPathMatch) {
    issues.push('Cannot find OPF file path in container.xml');
    return { isValid: false, issues };
  }

  const opfPath = opfPathMatch[1];
  const opfContent = await zip.file(opfPath)?.async('text');
  if (!opfContent) {
    issues.push('Missing OPF file');
    return { isValid: false, issues };
  }

  // Check for manifest
  if (!opfContent.includes('<manifest')) {
    issues.push('Missing <manifest> in OPF');
  }

  // Check for spine
  if (!opfContent.includes('<spine')) {
    issues.push('Missing <spine> in OPF');
  }

  // Parse manifest items
  const manifestItems = new Map<string, ManifestItem>();
  const manifestMatches = opfContent.matchAll(/<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]+media-type="([^"]+)"/g);
  for (const match of manifestMatches) {
    manifestItems.set(match[1], {
      href: match[2],
      mediaType: match[3]
    });
  }

  // Validate spine references
  const spineMatches = opfContent.matchAll(/<itemref[^>]+idref="([^"]+)"/g);
  for (const match of spineMatches) {
    const idref = match[1];
    if (!manifestItems.has(idref)) {
      issues.push(`Spine references non-existent manifest item: ${idref}`);
    }
  }

  // Log validation results
  if (issues.length > 0) {
    console.log('📚 EPUB Validation Issues:', issues);
  } else {
    console.log('📚 EPUB Validation: ✅ All checks passed');
  }

  return {
    isValid: issues.length === 0,
    issues,
    opfPath,
    opfContent,
    manifestItems
  };
}; 