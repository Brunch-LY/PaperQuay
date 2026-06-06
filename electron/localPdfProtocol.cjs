const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { net, protocol } = require('electron');

const LOCAL_PDF_PROTOCOL = 'paperquay-pdf';

function registerLocalPdfProtocolScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LOCAL_PDF_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function createPlainResponse(message, status = 400) {
  return new Response(message, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

async function handleLocalPdfRequest(request) {
  let requestUrl;

  try {
    requestUrl = new URL(request.url);
  } catch {
    return createPlainResponse('Invalid PDF request URL.');
  }

  if (requestUrl.hostname !== 'local') {
    return createPlainResponse('Unknown PDF source.', 404);
  }

  const filePath = requestUrl.searchParams.get('path') || '';

  if (!filePath || path.extname(filePath).toLowerCase() !== '.pdf') {
    return createPlainResponse('Only PDF files can be served by this protocol.');
  }

  try {
    const stat = await fsp.stat(filePath);

    if (!stat.isFile()) {
      return createPlainResponse('PDF path is not a file.', 404);
    }
  } catch {
    return createPlainResponse('PDF file does not exist.', 404);
  }

  return net.fetch(pathToFileURL(filePath).toString());
}

function registerLocalPdfProtocol() {
  protocol.handle(LOCAL_PDF_PROTOCOL, handleLocalPdfRequest);
}

module.exports = {
  LOCAL_PDF_PROTOCOL,
  registerLocalPdfProtocol,
  registerLocalPdfProtocolScheme,
};
