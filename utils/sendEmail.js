const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
        throw new Error('Email credentials missing: Please check EMAIL_USER and EMAIL_PASS in your environment.');
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: user.trim(),
            pass: pass.trim().replace(/\s+/g, '') // স্পেস থাকলেও স্বয়ংক্রিয়ভাবে মুছে দেবে
        }
    });

    const mailOptions = {
        from: `"AVEN Official" <${user.trim()}>`,
        to,
        subject,
        html
    };

    return await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;