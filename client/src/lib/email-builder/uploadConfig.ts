// Identifies the template whose files receive the images uploaded from the Image block inspector.
// Set once by the sandbox root (the editor state itself lives in module-level stores as well).
type UploadConfig = { entityTypeId?: string; entityId?: number };

let config: UploadConfig = {};

export function setUploadConfig(c: UploadConfig) {
  config = c;
}

export function getUploadConfig(): UploadConfig {
  return config;
}
