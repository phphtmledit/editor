/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

let mammothModule: Promise<typeof import('mammoth')> | undefined;

const getMammoth = (): Promise<typeof import('mammoth')> => {
  mammothModule ??= import('mammoth');
  return mammothModule;
};

export const loadMammoth = async (): Promise<void> => {
  await getMammoth();
};

export const convertDocx = async (arrayBuffer: ArrayBuffer) => {
  const mammoth = await getMammoth();
  return mammoth.convertToHtml({ arrayBuffer });
};
