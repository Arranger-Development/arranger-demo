function downloadBlob(blob, filename) {
  if (!(blob instanceof Blob)) {
    throw new TypeError('A Blob is required to download an export.');
  }
  if (typeof document === 'undefined') {
    throw new Error('Downloads are only available in a browser.');
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function createExportFilename(extension, basename = 'project-arranger') {
  const normalizedExtension = String(extension ?? '').replace(/^\./, '');
  if (!normalizedExtension) throw new TypeError('An export file extension is required.');

  const normalizedBasename = String(basename ?? '')
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'project-arranger';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${normalizedBasename}-${timestamp}.${normalizedExtension}`;
}

export {
  createExportFilename,
  downloadBlob,
};
