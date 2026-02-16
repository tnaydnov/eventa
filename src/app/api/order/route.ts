import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'חתונה',
  corporate: 'אירוע חברה / כנס',
  birthday: 'יום הולדת',
  conference: 'אירוע נטוורקינג',
  party: 'מסיבה פרטית',
  other: 'אחר',
};

/**
 * POST /api/order
 * Receives a new order form submission and sends an email notification.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventType, eventDate, contactName, contactPhone, contactEmail } = body;

    // Validate required fields
    if (!eventType || !eventDate || !contactName || !contactPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const eventLabel = EVENT_TYPE_LABELS[eventType] || eventType;

    await resend.emails.send({
      from: 'Eventa Orders <orders@eventa.productions>',
      to: 'contact@eventa.productions',
      subject: `🎉 הזמנה חדשה — ${eventLabel} | ${contactName}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #d4a59a; font-size: 24px; margin-bottom: 24px;">📋 הזמנה חדשה מהאתר</h1>
          
          <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <h2 style="font-size: 18px; color: #333; margin: 0 0 12px;">פרטי האירוע</h2>
            <p style="margin: 4px 0; color: #555;"><strong>סוג:</strong> ${eventLabel}</p>
            <p style="margin: 4px 0; color: #555;"><strong>תאריך:</strong> ${eventDate}</p>
          </div>

          <div style="background: #f9f9f9; border-radius: 12px; padding: 20px;">
            <h2 style="font-size: 18px; color: #333; margin: 0 0 12px;">פרטי יצירת קשר</h2>
            <p style="margin: 4px 0; color: #555;"><strong>שם:</strong> ${contactName}</p>
            <p style="margin: 4px 0; color: #555;"><strong>טלפון:</strong> <a href="tel:${contactPhone}">${contactPhone}</a></p>
            ${contactEmail ? `<p style="margin: 4px 0; color: #555;"><strong>אימייל:</strong> <a href="mailto:${contactEmail}">${contactEmail}</a></p>` : ''}
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="font-size: 12px; color: #999;">נשלח מטופס ההזמנה באתר eventa.productions</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Order email error:', error);
    return NextResponse.json({ error: 'Failed to send order' }, { status: 500 });
  }
}
