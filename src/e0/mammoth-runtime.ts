/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

type MammothBrowserModule = typeof import('../import/mammoth-browser');

let mammothModule: Promise<MammothBrowserModule> | undefined;

const getMammoth = (): Promise<MammothBrowserModule> => {
  mammothModule ??= import('../import/mammoth-browser');
  return mammothModule;
};

export const loadMammoth = async (): Promise<void> => {
  await getMammoth();
};

export const convertDocx = async (arrayBuffer: ArrayBuffer) => {
  const mammoth = await getMammoth();
  return mammoth.convertToHtml(arrayBuffer);
};
