/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import mammoth from 'mammoth';

export interface MammothMessage {
  type: string;
  message: string;
}

export interface MammothHtmlResult {
  value: string;
  messages: MammothMessage[];
}

export const convertToHtml = async (arrayBuffer: ArrayBuffer): Promise<MammothHtmlResult> => {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return {
    value: result.value,
    messages: result.messages.map(({ type, message }) => ({ type, message })),
  };
};
