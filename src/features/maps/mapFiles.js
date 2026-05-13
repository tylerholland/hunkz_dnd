export function isPdfContentType(contentType) {
  return contentType === "application/pdf";
}

export function isImageContentType(contentType) {
  return typeof contentType === "string" && contentType.startsWith("image/");
}

export function inferMapContentType(source) {
  if (typeof source === "object" && source?.contentType) {
    return source.contentType;
  }

  const value =
    typeof source === "string"
      ? source
      : source?.s3Key || source?.imageUrl || source?.name || "";
  const lower = String(value).toLowerCase();

  if (lower.match(/\.pdf(?:$|[?#])/)) return "application/pdf";
  if (lower.match(/\.jpe?g(?:$|[?#])/)) return "image/jpeg";
  if (lower.match(/\.png(?:$|[?#])/)) return "image/png";
  if (lower.match(/\.webp(?:$|[?#])/)) return "image/webp";
  if (lower.match(/\.gif(?:$|[?#])/)) return "image/gif";
  if (lower.match(/\.avif(?:$|[?#])/)) return "image/avif";
  if (lower.match(/\.svg(?:$|[?#])/)) return "image/svg+xml";
  return "";
}

export function isPdfMap(source) {
  return isPdfContentType(inferMapContentType(source));
}

export function isSupportedMapContentType(contentType) {
  return isImageContentType(contentType) || isPdfContentType(contentType);
}
