import { supabase } from '../lib/supabase';
import { Student, ClassCategory, TuitionRecord, UserProfile, LibraryResource, Event, AcademySettings, Message } from '../types';

export const PulseService = {

    // Legacy synchronous check support
    checkEmailExists: (email: string) => {
        return false; // Defer existence check to the actual async registration call
    },

    // --- AUTHENTICATION & REGISTRATION ---

    registerMaster: async (data: { name: string; email: string; password: string; academyName: string }) => {
        // 1. Sign Up User (Auto-creates Academy via DB Trigger if role=master & academy_name provided)
        // Ensure redirect URL matches your production or local setup
        const redirectUrl = window.location.origin + '/#/email-confirmed';

        const { data: authData, error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    name: data.name,
                    role: 'master',
                    academy_name: data.academyName // TRIGGER will catch this and create Academy
                },
                emailRedirectTo: redirectUrl
            }
        });

        if (error) {
            console.error("Supabase SignUp Error:", error);
            if (error.status === 429) {
                throw new Error("RATE_LIMIT_EXCEEDED");
            }
            throw error;
        }
        if (!authData.user) throw new Error('No user returned from signup');


        return { success: true };
    },

    resendVerificationEmail: async (email: string) => {
        const redirectUrl = window.location.origin + '/#/email-confirmed';
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: redirectUrl
            }
        });
        if (error) throw error;
        return { success: true };
    },

    registerStudent: async (data: any) => {
        // 1. Find Academy
        let academyId = data.academyId;
        if (!academyId) {
            // Look up by code if passed
            const { data: acad, error: acadError } = await supabase.from('academies').select('id').eq('code', data.academyCode).maybeSingle();
            if (acadError) throw acadError;
            if (!acad) throw new Error("Código de academia inválido");
            academyId = (acad as any).id;
        }

        // 2. Create Auth User to trigger Email Confirmation
        const redirectUrl = window.location.origin + '/#/email-confirmed';
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    name: data.name,
                    role: 'student',
                    academy_id: academyId
                    // We don't need academy_name here usually, but storing academy_id in metadata is good practice
                },
                emailRedirectTo: redirectUrl
            }
        });

        if (authError) {
            if (authError.status === 429) {
                throw new Error("RATE_LIMIT_EXCEEDED");
            }
            throw authError;
        }
        const userId = authData.user?.id;

        // 3. Insert Student Record linked to Auth User
        const { data: studentData, error: studentError } = await (supabase
            .from('students') as any)
            .insert({
                academy_id: academyId,
                user_id: userId, // Link to Auth User
                name: data.name,
                email: data.email,
                cell_phone: data.cellPhone,
                age: parseInt(data.age),
                birth_date: data.birthDate,
                weight: parseFloat(data.weight),
                height: parseFloat(data.height),
                blood_type: data.bloodType,
                guardian: {
                    fullName: data.guardianName,
                    email: data.guardianEmail,
                    relationship: data.guardianRelationship,
                    phones: {
                        main: data.guardianMainPhone,
                        secondary: data.guardianSecondaryPhone
                    },
                    address: {
                        street: data.street,
                        exteriorNumber: data.exteriorNumber,
                        colony: data.colony,
                        zipCode: data.zipCode
                    }
                },
                status: 'active',
                rank_current: 'White Belt',
                balance: 0
            } as any)
            .select();

        if (studentError) {
            // If student DB insertion fails, we might want to cleanup the auth user, 
            // but for now let's just throw. The user exists in Auth but has no student profile.
            console.error("Error creating student profile:", studentError);
            throw studentError;
        }

        return (studentData as any)?.[0];
    },

    // --- DATA ACCESS ---

    getStudents: async (academyId: string): Promise<Student[]> => {
        const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('academy_id', academyId);

        if (error) throw error;

        // Map DB to Frontend Type
        return (data || []).map((s: any) => ({
            ...s,
            userId: s.user_id || s.id, // Fallback
            academyId: s.academy_id,
            cellPhone: s.cell_phone,
            birthDate: s.birth_date,
            bloodType: s.blood_type,
            rank: s.rank_current || 'White Belt',
            rankColor: 'white', // Need to map from rank definitions
            guardian: s.guardian,
            avatarUrl: s.avatar_url,
            joinDate: s.join_date,
            classesId: [], // Need separate query if we want classes
            attendanceHistory: []
        }));
    },

    getClasses: async (academyId: string): Promise<ClassCategory[]> => {
        const { data, error } = await supabase
            .from('classes')
            .select('*')
            .eq('academy_id', academyId);

        if (error) throw error;
        return (data || []).map((c: any) => ({
            id: c.id,
            academyId: c.academy_id,
            name: c.name,
            schedule: c.schedule_summary || '',
            days: c.days || [],
            startTime: c.start_time,
            endTime: c.end_time,
            instructor: c.instructor,
            studentCount: 0, // Need aggregation
            studentIds: [],
            modifications: []
        }));
    },

    getEvents: async (academyId: string): Promise<Event[]> => {
        const { data, error } = await supabase.from('events').select('*').eq('academy_id', academyId);
        if (error) throw error;

        return (data || []).map((e: any) => ({
            id: e.id,
            academyId: e.academy_id,
            title: e.title,
            start: new Date(e.start_time),
            end: new Date(e.end_time),
            instructor: e.instructor,
            status: e.status,
            color: e.color,
            description: e.description,
            type: e.type,
            // Legacy mapping
            date: e.start_time.split('T')[0],
            time: e.start_time.split('T')[1],
            registrants: e.registrants || [],
            registeredCount: (e.registrants || []).length,
            capacity: 100
        }));
    },

    getPayments: async (academyId: string): Promise<TuitionRecord[]> => {
        const { data, error } = await supabase
            .from('tuition_records')
            .select('*')
            .eq('academy_id', academyId);

        if (error) throw error;

        return (data || []).map((p: any) => ({
            id: p.id,
            academyId: p.academy_id,
            studentId: p.student_id,
            concept: p.concept,
            month: p.month,
            amount: p.amount,
            originalAmount: p.original_amount,
            penaltyAmount: p.penalty_amount,
            dueDate: p.due_date,
            paymentDate: p.payment_date,
            status: p.status,
            method: p.method,
            proofUrl: p.proof_url,
            type: 'charge',
            canBePaidInParts: p.can_be_paid_in_parts,
            category: p.category,
            description: p.description
        }));
    },

    getStudentPayments: async (studentId: string): Promise<TuitionRecord[]> => {
        const { data, error } = await supabase
            .from('tuition_records')
            .select('*')
            .eq('student_id', studentId);

        if (error) throw error;

        return (data || []).map((p: any) => ({
            id: p.id,
            academyId: p.academy_id,
            studentId: p.student_id,
            concept: p.concept,
            month: p.month,
            amount: p.amount,
            originalAmount: p.original_amount,
            penaltyAmount: p.penalty_amount,
            dueDate: p.due_date,
            paymentDate: p.payment_date,
            status: p.status,
            method: p.method,
            proofUrl: p.proof_url,
            type: 'charge',
            canBePaidInParts: p.can_be_paid_in_parts,
            category: p.category,
            description: p.description
        }));
    },


    // --- WRITE OPERATIONS ---

    savePayments: async (payments: TuitionRecord[]) => {
        // Upsert payments
        if (payments.length === 0) return;

        const updates = payments.map(p => ({
            id: p.id,
            academy_id: p.academyId,
            student_id: p.studentId,
            concept: p.concept,
            month: p.month,
            amount: p.amount,
            original_amount: p.originalAmount,
            penalty_amount: p.penaltyAmount,
            due_date: p.dueDate,
            payment_date: p.paymentDate,
            status: p.status,
            method: p.method,
            proof_url: p.proofUrl,
            category: p.category,
            description: p.description,
            can_be_paid_in_parts: p.canBePaidInParts
        }));

        const { error } = await (supabase
            .from('tuition_records') as any)
            .upsert(updates as any);

        if (error) throw error;
    },

    deletePayment: async (recordId: string) => {
        const { error } = await supabase.from('tuition_records').delete().eq('id', recordId);
        if (error) throw error;
    },

    updatePaymentRecord: async (record: TuitionRecord) => {
        const { error } = await (supabase
            .from('tuition_records') as any)
            .update({
                status: record.status,
                amount: record.amount,
                // ... other fields
            } as any)
            .eq('id', record.id);
        if (error) throw error;
    },

    uploadProof: async (file: File) => {
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
            .from('pulse-assets')
            .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('pulse-assets')
            .getPublicUrl(fileName);

        return publicUrl;
    },

    // --- ACADEMY SETTINGS ---

    getAcademySettings: async (academyId: string): Promise<AcademySettings> => {
        const { data, error } = await supabase.from('academies').select('*').eq('id', academyId).single();
        if (error) throw error;
        if (!data) throw new Error("Academy settings not found");
        const d = data as any;
        return {
            id: d.id,
            name: d.name,
            code: d.code,
            ownerId: d.owner_id || '',
            modules: d.modules as any,
            paymentSettings: d.payment_settings as any,
            ranks: (d.ranks as any) || [],
        };
    },

    saveAcademySettings: async (settings: AcademySettings) => {
        const { error } = await (supabase.from('academies') as any).update({
            payment_settings: settings.paymentSettings,
            ranks: settings.ranks
        } as any).eq('id', settings.id);
        if (error) throw error;
    },

    seedDefaultRanks: async (academyId: string) => {
        const defaultRanks = [
            { id: crypto.randomUUID(), name: 'Cinturón Blanco', color: 'white', order: 1, requiredAttendance: 0 },
            { id: crypto.randomUUID(), name: 'Cinturón de Color', color: 'yellow', order: 2, requiredAttendance: 24 },
            { id: crypto.randomUUID(), name: 'Cinturón Negro', color: 'black', order: 3, requiredAttendance: 100 }
        ];

        // Fetch current settings first to preserve other fields
        const { data: currentSettings, error: fetchError } = await supabase
            .from('academies')
            .select('*')
            .eq('id', academyId)
            .single();

        if (fetchError) throw fetchError;

        const { error } = await (supabase.from('academies') as any).update({
            ranks: defaultRanks
        } as any).eq('id', academyId);

        if (error) throw error;
        return defaultRanks;
    },

    // --- ATOMIC UPDATES ---

    updateStudent: async (student: Student) => {
        const { error } = await (supabase.from('students') as any).update({
            name: student.name,
            email: student.email,
            cell_phone: student.cellPhone,
            rank_current: student.rank,
            rank_id: student.rankId,
            status: student.status,
            balance: student.balance,
            stripes: student.stripes,
            guardian: student.guardian,
            avatar_url: student.avatarUrl
        } as any).eq('id', student.id);
        if (error) throw error;
    },

    // Safe update for students to edit their own profile
    updateStudentProfile: async (studentId: string, updates: Partial<Student>) => {
        const safeUpdates: any = {};
        if (updates.name) safeUpdates.name = updates.name;
        if (updates.email) safeUpdates.email = updates.email;
        if (updates.cellPhone) safeUpdates.cell_phone = updates.cellPhone;
        if (updates.avatarUrl) safeUpdates.avatar_url = updates.avatarUrl;

        // Guardian updates
        if (updates.guardian) {
            safeUpdates.guardian = updates.guardian;
        }

        if (Object.keys(safeUpdates).length === 0) return;

        const { error } = await (supabase.from('students') as any)
            .update(safeUpdates)
            .eq('id', studentId);

        if (error) throw error;
    },

    deleteStudent: async (id: string) => {
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (error) throw error;
    },

    createClass: async (cls: ClassCategory) => {
        const { data, error } = await (supabase.from('classes') as any).insert({
            academy_id: cls.academyId,
            name: cls.name,
            days: cls.days,
            start_time: cls.startTime,
            end_time: cls.endTime,
            instructor: cls.instructor,
            student_ids: cls.studentIds
        } as any).select().single();
        if (error) throw error;
        return data;
    },

    updateClass: async (cls: ClassCategory) => {
        const { error } = await (supabase.from('classes') as any).update({
            name: cls.name,
            days: cls.days,
            start_time: cls.startTime,
            end_time: cls.endTime,
            instructor: cls.instructor,
            student_ids: cls.studentIds
        } as any).eq('id', cls.id);
        if (error) throw error;
    },

    deleteClass: async (id: string) => {
        const { error } = await supabase.from('classes').delete().eq('id', id);
        if (error) throw error;
    },

    createEvent: async (evt: Event) => {
        const { data, error } = await (supabase.from('events') as any).insert({
            academy_id: evt.academyId,
            title: evt.title,
            start_time: evt.start.toISOString(),
            end_time: evt.end.toISOString(),
            description: evt.description,
            instructor: evt.instructor,
            color: evt.color,
            type: evt.type,
            registrants: evt.registrants
        } as any).select().single();
        if (error) throw error;
        return data;
    },

    updateEvent: async (evt: Event) => {
        const { error } = await (supabase.from('events') as any).update({
            title: evt.title,
            start_time: evt.start.toISOString(),
            end_time: evt.end.toISOString(),
            description: evt.description,
            instructor: evt.instructor,
            color: evt.color,
            status: evt.status,
            registrants: evt.registrants
        } as any).eq('id', evt.id);
        if (error) throw error;
    },

    deleteEvent: async (id: string) => {
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) throw error;
    },

    // --- LIBRARY ---

    getLibrary: async (academyId: string): Promise<LibraryResource[]> => {
        const { data, error } = await supabase.from('library').select('*').eq('academy_id', academyId);
        if (error) throw error;
        return (data || []).map((l: any) => ({
            id: l.id,
            academyId: l.academy_id,
            title: l.title,
            description: l.description,
            thumbnailUrl: l.thumbnail_url,
            videoUrl: l.video_url,
            duration: l.duration,
            category: l.category,
            level: l.level,
            completedBy: l.completed_by || []
        }));
    },

    createLibraryResource: async (res: LibraryResource) => {
        const { error } = await (supabase.from('library') as any).insert({
            academy_id: res.academyId,
            title: res.title,
            description: res.description,
            thumbnail_url: res.thumbnailUrl,
            video_url: res.videoUrl,
            duration: res.duration,
            category: res.category,
            level: res.level,
            completed_by: []
        } as any);
        if (error) throw error;
    },

    deleteLibraryResource: async (id: string) => {
        const { error } = await supabase.from('library').delete().eq('id', id);
        if (error) throw error;
    },

    toggleResourceCompletion: async (resourceId: string, studentId: string, currentCompletedBy: string[]) => {
        let newCompletedBy = [...currentCompletedBy];
        if (newCompletedBy.includes(studentId)) {
            newCompletedBy = newCompletedBy.filter(id => id !== studentId);
        } else {
            newCompletedBy.push(studentId);
        }

        const { error } = await (supabase.from('library') as any).update({
            completed_by: newCompletedBy
        } as any).eq('id', resourceId);
        if (error) throw error;
    },

    // Missing helper for Context
    // Missing helper for Context
    saveStudents: async (students: Student[]) => {
        if (students.length === 0) return;

        const updates = students.map(s => ({
            id: s.id,
            academy_id: s.academyId,
            name: s.name,
            email: s.email,
            rank_current: s.rank, // Mapped from 'rank' to 'rank_current'
            rank_id: s.rankId || null,
            status: s.status,
            balance: s.balance,
            stripes: s.stripes,
            guardian: s.guardian as any, // Cast to any to satisfy Json type
            avatar_url: s.avatarUrl,
            cell_phone: s.cellPhone,
            user_id: s.userId || null,
            birth_date: s.birthDate,
            age: typeof s.age === 'string' ? parseInt(s.age) : s.age,
            weight: typeof s.weight === 'string' ? parseFloat(s.weight) : s.weight,
            height: typeof s.height === 'string' ? parseFloat(s.height) : s.height,
            blood_type: s.bloodType
        }));

        const { error } = await (supabase.from('students') as any).upsert(updates);
        if (error) throw error;
    },

    saveClasses: async (classes: ClassCategory[]) => {
        if (classes.length === 0) return;
        const updates = classes.map(c => ({
            id: c.id,
            academy_id: c.academyId,
            name: c.name,
            days: c.days,
            start_time: c.startTime,
            end_time: c.endTime,
            instructor: c.instructor,
            student_ids: c.studentIds
        }));
        const { error } = await (supabase.from('classes') as any).upsert(updates);
        if (error) throw error;
    },

    saveEvents: async (events: Event[]) => {
        if (events.length === 0) return;
        const updates = events.map(e => ({
            id: e.id,
            academy_id: e.academyId,
            title: e.title,
            start_time: e.start instanceof Date ? e.start.toISOString() : e.start,
            end_time: e.end instanceof Date ? e.end.toISOString() : e.end,
            type: e.type,
            registrants: e.registrants,
            description: e.description,
            instructor: e.instructor,
            color: e.color
        }));
        const { error } = await (supabase.from('events') as any).upsert(updates);
        if (error) throw error;
    },

    saveLibrary: async (resources: LibraryResource[]) => {
        if (resources.length === 0) return;
        const updates = resources.map(r => ({
            id: r.id,
            academy_id: r.academyId,
            title: r.title,
            description: r.description,
            thumbnail_url: r.thumbnailUrl,
            video_url: r.videoUrl,
            duration: r.duration,
            category: r.category,
            level: r.level
        }));
        const { error } = await (supabase.from('library') as any).upsert(updates);
        if (error) throw error;
    },

    // --- MESSAGES ---

    getMessages: async (academyId: string): Promise<Message[]> => {
        const { data, error } = await supabase.from('messages').select('*').eq('academy_id', academyId).order('date', { ascending: false });
        if (error) throw error;
        return (data || []).map((m: any) => ({
            id: m.id,
            academyId: m.academy_id,
            senderId: m.sender_id,
            senderName: m.sender_name,
            recipientId: m.recipient_id,
            recipientName: m.recipient_name,
            subject: m.subject,
            content: m.content,
            date: m.date, // Assuming string (ISO)
            read: m.read,
            type: m.type
        }));
    },

    sendMessage: async (msg: Partial<Message>) => {
        // Expect msg to have academyId, etc.
        const { error } = await (supabase.from('messages') as any).insert({
            academy_id: msg.academyId,
            sender_id: msg.senderId,
            sender_name: msg.senderName,
            recipient_id: msg.recipientId,
            recipient_name: msg.recipientName,
            subject: msg.subject,
            content: msg.content,
            type: msg.type,
            read: false,
            date: new Date().toISOString()
        } as any);
        if (error) throw error;
    },

    markMessageRead: async (id: string) => {
        const { error } = await (supabase.from('messages') as any).update({ read: true }).eq('id', id);
        if (error) throw error;
    },
    // --- LEGACY / HELPER FACADES ---
    createStudentAccountFromMaster: async (student: Student, password: string) => {
        // Placeholder for auth creation logic
        // Placeholder for auth creation logic
        return { success: true };
    },

    deleteFullStudentData: async (id: string) => {
        return PulseService.deleteStudent(id);
    },

    updateEventRegistrants: (events: Event[], eventId: string, studentIds: string[]) => {
        const evt = events.find(e => e.id === eventId);
        if (evt) {
            const updated = { ...evt, registrants: studentIds };
            // Fire and forget async update
            PulseService.updateEvent(updated).catch(console.error);
            return events.map(e => e.id === eventId ? updated : e);
        }
        return events;
    }
};