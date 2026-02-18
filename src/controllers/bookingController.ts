import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { sendBookingConfirmation } from '../services/EmailService';
import { HttpError } from '../errors/HttpError';

// Helper to format currency
const formatCurrency = (amount: any, currency: string = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: currency.toUpperCase()
    }).format(Number(amount));
};

export const getAllBookings = async (req: Request, res: Response) => {
    try {
        const bookings = await prisma.booking.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                package: true 
            }
        });
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
};

export const confirmBookingPayment = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const booking = await prisma.booking.findUnique({
            where: { id },
            include: { package: true }
        });

        if (!booking) {
            throw new HttpError(404, 'Booking not found');
        }

        if (booking.status === 'paid') {
            throw new HttpError(400, 'Booking is already paid');
        }

        // If amountPaid is 0 (manual booking pending), set it from package price
        let finalAmount = booking.amountPaid;
        
        // Logic to determine correct amount for manual bookings
        if (Number(booking.amountPaid) === 0 && booking.package) {
             if (booking.paymentType === 'DEPOSIT') {
                 finalAmount = booking.package.depositPrice;
             } else if (booking.paymentType === 'FULL') {
                 finalAmount = booking.package.totalPrice;
             } else if (booking.paymentType === 'BALANCE') {
                 // Calculate balance: Total - Deposit
                 // Ensure we are working with Decimals or Numbers correctly
                 const total = Number(booking.package.totalPrice);
                 const deposit = Number(booking.package.depositPrice);
                 finalAmount = new Prisma.Decimal(total - deposit);
             }
        }
        
        // Update status to paid and update amount if needed
        const updatedBooking = await prisma.booking.update({
            where: { id },
            data: { 
                status: 'paid',
                amountPaid: finalAmount 
            }
        });

        // Send confirmation email if customer email exists
        if (booking.customerEmail) {
             const packageName = booking.package ? booking.package.name : 'Custom Package';
             const amountFormatted = formatCurrency(finalAmount, booking.currency);
             
             // Check if paymentType is valid, otherwise default to DEPOSIT
             let paymentType: 'DEPOSIT' | 'FULL' | 'BALANCE' = 'DEPOSIT';
             if (booking.paymentType === 'FULL' || booking.paymentType === 'BALANCE') {
                 paymentType = booking.paymentType;
             }

             await sendBookingConfirmation({
                customerName: booking.customerName || 'Client',
                customerEmail: booking.customerEmail,
                amount: amountFormatted,
                packageName: packageName,
                paymentType: paymentType,
                locale: booking.locale,
                stripeSessionId: booking.stripeSessionId || `MANUAL-${booking.id}`,
                sessionDate: booking.sessionDate?.toISOString()
             });
        }

        res.json(updatedBooking);
    } catch (error) {
        if (error instanceof HttpError) {
             res.status(error.status).json({ error: error.message });
        } else {
            console.error('Error confirming booking:', error);
            res.status(500).json({ error: 'Failed to confirm booking' });
        }
    }
};

export const deleteBooking = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        await prisma.booking.delete({
            where: { id }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ error: 'Failed to delete booking' });
    }
};
