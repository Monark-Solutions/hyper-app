import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import supabase from '@/lib/supabase';
import { hashPassword } from '@/utils/password';
import generator from 'generate-password';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendPasswordResetEmail(to: string, newPassword: string): Promise<boolean> {
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject: 'Hyper Digital Signage - Password Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset</h2>
          <p>Your password has been reset successfully.</p>
          <p>Your new password is: <strong>${newPassword}</strong></p>
          <p>Please login with this password and change it immediately for security purposes.</p>
          <p style="margin-top: 20px;">
            If you did not request this password reset, please contact support immediately.
          </p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #6b7280; font-size: 0.875rem;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, customerId } = body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Check if user exists
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        userid,
        username,
        customers!inner(
          customerid
        )
      `)
      .eq('useremail', email)
      .eq('customers.customerid', parseInt(customerId))
      .eq('isdeleted', false)
      .eq('isactive', true)
      .eq('customers.isactive', true)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'No account found with these credentials' },
        { status: 404 }
      );
    }

    // Generate new password
    const newPassword = generator.generate({
      length: 7,
      numbers: true,
      symbols: false,
      uppercase: true,
      lowercase: true,
      strict: true
    });

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('userid', userData.userid);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Send email with new password
    const emailSent = await sendPasswordResetEmail(email, newPassword);
    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send password reset email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
