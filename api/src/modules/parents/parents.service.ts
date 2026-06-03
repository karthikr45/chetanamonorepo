import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Parent } from './entities/parent.entity';
import { ParentStudent, Relationship } from './entities/parent-student.entity';
import { Student } from '../students/entities/student.entity';
import { CreateParentDto, ParentStudentLinkDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';

@Injectable()
export class ParentsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ParentsService.name);

  constructor(
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,
    @InjectRepository(ParentStudent)
    private readonly linkRepo: Repository<ParentStudent>,
    private readonly dataSource: DataSource,
  ) {}

  async create(tenantId: string, dto: CreateParentDto): Promise<Parent> {
    const email = dto.email.toLowerCase();
    const existing = await this.parentRepo.findOne({
      where: { tenantId, email },
    });
    if (existing) {
      throw new ConflictException(
        `A parent with email ${email} already exists for this tenant`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const parent = manager.getRepository(Parent).create({
        tenantId,
        name: dto.name,
        email,
        phoneNumber: dto.phoneNumber ?? null,
        isActive: dto.isActive ?? true,
      });
      const saved = await manager.getRepository(Parent).save(parent);

      const links = dto.students.map((s) =>
        manager.getRepository(ParentStudent).create({
          parentId: saved.id,
          tenantId,
          admissionNumber: s.admissionNumber,
          relationship: s.relationship,
          isPrimary: s.isPrimary ?? false,
        }),
      );
      await manager.getRepository(ParentStudent).save(links);

      this.logger.log(
        `Created parent ${saved.id} (${email}) with ${links.length} student link(s)`,
      );
      return this.findOneOrFail(tenantId, saved.id);
    });
  }

  async findAll(tenantId: string): Promise<Parent[]> {
    return this.parentRepo.find({
      where: { tenantId },
      relations: ['studentLinks'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOneOrFail(tenantId: string, id: string): Promise<Parent> {
    const parent = await this.parentRepo.findOne({
      where: { id, tenantId },
      relations: ['studentLinks'],
    });
    if (!parent) {
      throw new NotFoundException(`Parent ${id} not found`);
    }
    return parent;
  }

  async findByEmailGlobal(email: string): Promise<Parent[]> {
    return this.parentRepo.find({
      where: { email: email.toLowerCase(), isActive: true },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateParentDto,
  ): Promise<Parent> {
    const parent = await this.findOneOrFail(tenantId, id);

    if (dto.email && dto.email.toLowerCase() !== parent.email) {
      const conflict = await this.parentRepo.findOne({
        where: { tenantId, email: dto.email.toLowerCase() },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Email ${dto.email} already in use`);
      }
      parent.email = dto.email.toLowerCase();
    }
    if (dto.name !== undefined) parent.name = dto.name;
    if (dto.phoneNumber !== undefined) parent.phoneNumber = dto.phoneNumber;
    if (dto.isActive !== undefined) parent.isActive = dto.isActive;

    return this.parentRepo.save(parent);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const parent = await this.findOneOrFail(tenantId, id);
    await this.parentRepo.remove(parent);
  }

  async addStudentLink(
    tenantId: string,
    parentId: string,
    dto: ParentStudentLinkDto,
  ): Promise<ParentStudent> {
    await this.findOneOrFail(tenantId, parentId);
    const existing = await this.linkRepo.findOne({
      where: {
        parentId,
        tenantId,
        admissionNumber: dto.admissionNumber,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Parent already linked to admission ${dto.admissionNumber}`,
      );
    }
    const link = this.linkRepo.create({
      parentId,
      tenantId,
      admissionNumber: dto.admissionNumber,
      relationship: dto.relationship,
      isPrimary: dto.isPrimary ?? false,
    });
    return this.linkRepo.save(link);
  }

  async removeStudentLink(
    tenantId: string,
    parentId: string,
    linkId: string,
  ): Promise<void> {
    await this.findOneOrFail(tenantId, parentId);
    const link = await this.linkRepo.findOne({
      where: { id: linkId, parentId, tenantId },
    });
    if (!link) {
      throw new NotFoundException(`Student link ${linkId} not found`);
    }
    await this.linkRepo.remove(link);
  }

  async findStudentLinksByParent(parentId: string): Promise<ParentStudent[]> {
    return this.linkRepo.find({ where: { parentId } });
  }

  async updateRefreshToken(
    parentId: string,
    hash: string | null,
  ): Promise<void> {
    await this.parentRepo.update(parentId, { refreshTokenHash: hash });
  }

  /**
   * Idempotent: turn a student's parent-contact email into a real Parent
   * row + ParentStudent link, so the parent can log in by email-OTP
   * without an admin separately creating a Parent. Safe to call from
   * any student create/update path. One parent → many children via
   * additional links on the same Parent row.
   */
  async ensureForStudent(
    tenantId: string,
    args: {
      email: string | null | undefined;
      name?: string | null;
      phoneNumber?: string | null;
      admissionNumber: string;
      relationship?: Relationship;
    },
    manager?: EntityManager,
  ): Promise<Parent | null> {
    const email = (args.email ?? '').trim().toLowerCase();
    if (!email) return null;

    const run = async (m: EntityManager): Promise<Parent> => {
      const parentRepo = m.getRepository(Parent);
      const linkRepo = m.getRepository(ParentStudent);

      let parent = await parentRepo.findOne({ where: { tenantId, email } });
      if (!parent) {
        parent = await parentRepo.save(
          parentRepo.create({
            tenantId,
            name: (args.name ?? '').trim() || email,
            email,
            phoneNumber: (args.phoneNumber ?? '').trim() || null,
            isActive: true,
          }),
        );
        this.logger.log(
          `Auto-created parent ${parent.id} (${email}) from student record`,
        );
      } else if (!parent.isActive) {
        parent.isActive = true;
        parent = await parentRepo.save(parent);
      }

      const existing = await linkRepo.findOne({
        where: {
          parentId: parent.id,
          tenantId,
          admissionNumber: args.admissionNumber,
        },
      });
      if (!existing) {
        const anyPrimary = await linkRepo.findOne({
          where: { parentId: parent.id, isPrimary: true },
        });
        await linkRepo.save(
          linkRepo.create({
            parentId: parent.id,
            tenantId,
            admissionNumber: args.admissionNumber,
            relationship: args.relationship ?? Relationship.GUARDIAN,
            isPrimary: !anyPrimary,
          }),
        );
      }
      return parent;
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  /**
   * Sweep existing Student rows with a parent-contact email and make sure
   * each one has a corresponding Parent + ParentStudent link, so parents
   * of pre-existing students can log in without re-keying the data.
   *
   * Idempotent — running it repeatedly is a no-op. Scoped to one tenant
   * when called from the admin endpoint; the bootstrap call runs over
   * every tenant.
   */
  async backfillFromStudents(tenantId?: string): Promise<{
    scanned: number;
    parentsTouched: number;
    skipped: number;
  }> {
    const studentRepo = this.dataSource.getRepository(Student);
    const qb = studentRepo
      .createQueryBuilder('s')
      .where("s.email IS NOT NULL AND s.email <> ''");
    if (tenantId) qb.andWhere('s.tenantId = :tenantId', { tenantId });
    const students = await qb.getMany();

    let parentsTouched = 0;
    let skipped = 0;
    for (const s of students) {
      try {
        const p = await this.ensureForStudent(s.tenantId, {
          email: s.email,
          name: s.name,
          phoneNumber: s.phoneNumber,
          admissionNumber: s.admissionNumber,
        });
        if (p) parentsTouched++;
      } catch (err) {
        skipped++;
        this.logger.warn(
          `Backfill skipped student ${s.id}: ${(err as Error).message}`,
        );
      }
    }
    return { scanned: students.length, parentsTouched, skipped };
  }

  /**
   * Run the student → parent backfill once at boot. Non-fatal: a failure
   * here must not block the API from starting (e.g. DB not yet ready in
   * a CI smoke test). One-shot, idempotent, and quiet when there's
   * nothing to do.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const r = await this.backfillFromStudents();
      if (r.scanned > 0) {
        this.logger.log(
          `Parent backfill: scanned ${r.scanned} student(s), touched ${r.parentsTouched} parent(s), skipped ${r.skipped}.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Parent backfill skipped at boot: ${(err as Error).message}`,
      );
    }
  }
}
