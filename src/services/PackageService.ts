import { prisma } from '../database/client';

interface CreatePackageDTO {
  name: string;
  description?: string;
  totalPrice: number;
  depositPrice: number;
  stripeProductId?: string;
}

interface UpdatePackageDTO {
  name?: string;
  description?: string;
  totalPrice?: number;
  depositPrice?: number;
  stripeProductId?: string;
  active?: boolean;
}

export class PackageService {
  
  static async listAll() {
    return prisma.package.findMany({
      where: { active: true },
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
            active: true
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

    // Soft Delete
    return prisma.package.update({
      where: { id },
      data: { active: false }
    });
  }
}
