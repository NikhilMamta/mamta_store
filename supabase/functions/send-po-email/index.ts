const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SendPoEmailPayload = {
  to?: string;
  vendorName?: string;
  poNumber?: string;
  pdfUrl?: string;
  fileName?: string;
};

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

Deno.serve(async (req) => {
  // Handle CORS preflight request explicitly with 200 OK
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('PO_FROM_EMAIL') || Deno.env.get('FROM_EMAIL');

    if (!resendApiKey || !fromEmail) {
      return new Response(
        JSON.stringify({ success: false, message: 'Email provider is not configured (RESEND_API_KEY or PO_FROM_EMAIL/FROM_EMAIL is missing)' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { to, vendorName, poNumber, pdfUrl, fileName } = await req.json() as SendPoEmailPayload;

    if (!to || !pdfUrl || !poNumber) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing email, PO number, or PDF URL' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error('Unable to fetch PO PDF');
    }

    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    const attachmentName = fileName || `PO-${poNumber}.pdf`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `Purchase Order ${poNumber}`,
        html: `
          <p>Dear ${vendorName || 'Vendor'},</p>
          <p>Please find attached purchase order <strong>${poNumber}</strong>.</p>
          <p>Regards,<br/>Stores Department</p>
        `,
        attachments: [
          {
            filename: attachmentName,
            content: toBase64(pdfBytes),
          },
        ],
      }),
    });

    const result = await resendResponse.json();

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, message: result?.message || 'Email provider failed', details: result }),
        { 
          status: resendResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Failed to send email' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
