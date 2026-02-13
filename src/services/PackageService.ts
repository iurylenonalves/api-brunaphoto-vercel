import { prisma } from '../database/client';

interface CreatePackageDTO {
  name: string;
  namePt?: string;
  description?: string;
  descriptionPt?: string;
  totalPrice: number;
  depositPrice: number;
  stripeProductId?: string;
  active?: boolean;
}

interface UpdatePackageDTO {
  name?: string;
  namePt?: string;
  description?: string;
  descriptionPt?: string;
  totalPrice?: number;
  depositPrice?: number;
  stripeProductId?: string;
  active?: boolean;
}

export class PackageService {
  
  static async listAll(includeInactive = false) {
    return prisma.package.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { totalPrice: 'asc' }
    });
  }

  static async findById(id: string) {
    return prisma.package.findUnique({
      where: { id }
    });
  }

  static async create(data: CreatePackageDTO) {
    return prisma.package.create({
        data: {
            ...data,
            active: data.active ?? true
        }
    });
  }


  static async update(id: string, data: UpdatePackageDTO) {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('Package not found');
    }

    return prisma.package.update({
      where: { id },
      data
    });
  }

  static async delete(id: string) {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('Package not found');
    }

    try {
        // Attempt Hard Delete first
        return await prisma.package.delete({
            where: { id }
        });
    } catch (error: any) {
        // If hard delete fails (e.g. Foreign Key constraint because of bookings), fallback to Soft Delete
        // Code 'P2003' is Foreign key constraint failed
        if (error.code === 'P2003') {
             return prisma.package.update({
                where: { id },
                data: { active: false }
            });
        }
        throw error;
    }
  }
}
