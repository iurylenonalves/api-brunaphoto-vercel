import { Request, Response } from 'express';
import { prisma } from '../database/client';

export class DashboardController {
    
    static async getStats(req: Request, res: Response) {
        try {
            // 1. Total Revenue (All time & Current Month)
            const totalRevenue = await prisma.booking.aggregate({
                _sum: { amountPaid: true },
                where: { status: 'paid' }
            });

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            
            const revenueMonth = await prisma.booking.aggregate({
                _sum: { amountPaid: true },
                where: { 
                    status: 'paid',
                    createdAt: { gte: startOfMonth }
                }
            });

            // 2. Booking Counts (Total, Pending, Completed)
            const bookingsTotal = await prisma.booking.count();
            const bookingsPending = await prisma.booking.count({ where: { status: 'pending' } });
            const bookingsPaid = await prisma.booking.count({ where: { status: 'paid' } });

            // 3. Payment Methods Breakdown (Stripe vs Transfer)
            // Fallback: If paymentMethod is null, check stripeSessionId
            const paymentsStripe = await prisma.booking.count({ 
                where: { 
                    OR: [
                        { paymentMethod: 'STRIPE' },
                        { AND: [{ paymentMethod: null }, { stripeSessionId: { not: null } }] }
                    ]
                } 
            });
            const paymentsTransfer = await prisma.booking.count({ 
                where: { 
                    OR: [
                        { paymentMethod: 'TRANSFER' },
                        { AND: [{ paymentMethod: null }, { stripeSessionId: null }] } // Assuming default is transfer if not stripe? Or strictly check?
                    ]
                } 
            });

            // 4. Booking Types (Deposit vs Full)
            const typeDeposit = await prisma.booking.count({ where: { paymentType: 'DEPOSIT' } });
            const typeFull = await prisma.booking.count({ where: { paymentType: 'FULL' } });

            // 5. Scheduled vs Unscheduled (Paid sessions only)
            const sessionsScheduled = await prisma.booking.count({ 
                where: { status: 'paid', sessionDate: { gt: now } } 
            });
            const sessionsCompleted = await prisma.booking.count({ 
                where: { status: 'paid', sessionDate: { lt: now } } 
            });
            const sessionsUnscheduled = await prisma.booking.count({ 
                where: { status: 'paid', sessionDate: null } 
            });

            // 6. Top Packages (Customers favorite)
            // Filter to only count initial sales (DEPOSIT or FULL) to avoid double counting balances
            const topPackages = await prisma.booking.groupBy({
                by: ['packageId'],
                where: {
                    paymentType: { in: ['DEPOSIT', 'FULL'] },
                    status: 'paid' 
                },
                _count: { id: true },
                orderBy: {
                    _count: { id: 'desc' }
                },
                take: 5
            });

            // 7. Monthly Sales History ( Last 6 months )
            // Since we can't easily group by month with Prisma in a standard way across dbs without raw queries, 
            // we will fetch data and process in JS or do individual queries for last 6 months.
            // Individual queries are safer for ORM.
            
            const salesHistory = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                // Avoid date overflow issues (e.g. if today is 31st and last month has 30 days)
                d.setDate(1); 
                d.setMonth(d.getMonth() - i);
                
                const start = new Date(d.getFullYear(), d.getMonth(), 1);
                // End of month: First day of NEXT month at 00:00:00 minus 1ms, or just use lt next month 1st
                const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
                
                const monthRevenue = await prisma.booking.aggregate({
                    _sum: { amountPaid: true },
                    where: { 
                        status: 'paid',
                        createdAt: { gte: start, lte: end }
                    }
                });
                
                salesHistory.push({
                    month: start.toLocaleString('default', { month: 'short' }),
                    revenue: Number(monthRevenue._sum.amountPaid || 0)
                });
            }

            // 8. Top Clients
            const topClients = await prisma.booking.groupBy({
                by: ['customerEmail', 'customerName'],
                _sum: { amountPaid: true },
                orderBy: {
                    _sum: { amountPaid: 'desc' }
                },
                take: 5,
                where: { status: 'paid' }
            });

            // 9. Stuck Packages (No sales in 90 days)
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            // Find packages that HAVE bookings in last 90 days
            const activePackageIds = await prisma.booking.groupBy({
                by: ['packageId'],
                where: {
                    createdAt: { gte: ninetyDaysAgo },
                    packageId: { not: null }
                }
            }).then(res => res.map(r => r.packageId).filter(Boolean) as string[]);

            // Find packages NOT in that list
            const stuckPackages = await prisma.package.findMany({
                where: {
                    id: { notIn: activePackageIds },
                    active: true
                },
                take: 5,
                select: { name: true, totalPrice: true }
            });

            // Resolve package names manually or via separate query since groupBy limits relations
            const packageDetails = await Promise.all(topPackages.map(async (p) => {
                let packageName = 'Custom Package';
                if (p.packageId) {
                    const pkg = await prisma.package.findUnique({ 
                        where: { id: p.packageId },
                        select: { name: true }
                    });
                     if (pkg?.name) packageName = pkg.name;
                }
                return { name: packageName, count: p._count.id };
            }));

            res.json({
                revenue: {
                    total: Number(totalRevenue._sum.amountPaid || 0),
                    month: Number(revenueMonth._sum.amountPaid || 0)
                },
                counts: {
                    total: bookingsTotal,
                    pending: bookingsPending,
                    paid: bookingsPaid
                },
                methods: {
                    stripe: paymentsStripe,
                    transfer: paymentsTransfer
                },
                types: {
                    deposit: typeDeposit,
                    full: typeFull
                },
                sessions: {
                    scheduled: sessionsScheduled,
                    completed: sessionsCompleted,
                    unscheduled: sessionsUnscheduled
                },
                salesHistory,
                topClients: topClients.map(c => ({
                    name: c.customerName || 'Unknown',
                    email: c.customerEmail,
                    total: Number(c._sum.amountPaid || 0)
                })),
                stuckPackages: stuckPackages.map(p => ({
                    name: p.name,
                    price: Number(p.totalPrice)
                })),
                topPackages: packageDetails
            });

        } catch (error) {
            console.error('Dashboard Stats Error:', error);
            res.status(500).json({ error: 'Failed to fetch dashboard stats' });
        }
    }
}
