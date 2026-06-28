import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  user: {
    email: string;
    id: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: EmailRequest = await req.json();
    
    console.log("Received email confirmation request for:", payload.user.email);

    const { user, email_data } = payload;
    const { token_hash, email_action_type, redirect_to } = email_data;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;

    // Professional HTML email template with Islamic theme
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirm Your Email - Tariq Islam</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  
                  <!-- Header with gradient -->
                  <tr>
                    <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 8px 8px 0 0; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                        Tariq Islam
                      </h1>
                      <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                        Islamic Community Platform
                      </p>
                    </td>
                  </tr>

                  <!-- Main content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">
                        Welcome to Tariq Islam!
                      </h2>
                      
                      <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                        Assalamu Alaikum! Thank you for joining our Islamic community platform. Please confirm your email address to get started.
                      </p>

                      <!-- Call to action button -->
                      <table role="presentation" style="width: 100%; margin: 30px 0;">
                        <tr>
                          <td align="center">
                            <a href="${confirmationUrl}" 
                               style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">
                              Confirm Email Address
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 30px 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                        Or copy and paste this link into your browser:
                      </p>
                      
                      <div style="padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; word-break: break-all;">
                        <a href="${confirmationUrl}" style="color: #059669; text-decoration: none; font-size: 13px;">
                          ${confirmationUrl}
                        </a>
                      </div>

                      <div style="margin-top: 30px; padding: 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                          <strong>Security Notice:</strong> If you didn't create an account with Tariq Islam, please ignore this email. Your email address will not be used without confirmation.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0 0 10px; color: #6b7280; font-size: 12px; text-align: center; line-height: 1.5;">
                        This email was sent by Tariq Islam - Your Islamic Community Platform
                      </p>
                      <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
                        © ${new Date().getFullYear()} Tariq Islam. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const textContent = `
Welcome to Tariq Islam!

Assalamu Alaikum! Thank you for joining our Islamic community platform.

Please confirm your email address by clicking the link below:
${confirmationUrl}

If you didn't create an account with Tariq Islam, please ignore this email.

© ${new Date().getFullYear()} Tariq Islam
    `.trim();

    // Send email in background to avoid timeout
    const sendEmailTask = async () => {
      try {
        const emailResponse = await resend.emails.send({
          from: "Tariq Islam <noreply@global-muslims-connect.com>",
          to: [user.email],
          subject: "Confirm Your Email - Tariq Islam",
          html: htmlContent,
          text: textContent,
        });
        console.log("Email sent successfully:", emailResponse);
      } catch (error) {
        console.error("Error sending email:", error);
      }
    };

    // Start background task without awaiting
    EdgeRuntime.waitUntil(sendEmailTask());

    // Return immediately to avoid timeout
    return new Response(JSON.stringify({ 
      success: true,
      message: "Confirmation email queued for delivery" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-confirmation-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send confirmation email",
        details: "Please check function logs for more information"
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
