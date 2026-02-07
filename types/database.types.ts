export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            academies: {
                Row: {
                    id: string
                    code: string
                    name: string
                    owner_id: string | null
                    payment_settings: Json | null
                    modules: Json | null
                    ranks: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    code: string
                    name: string
                    owner_id?: string | null
                    payment_settings?: Json | null
                    modules?: Json | null
                    ranks?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    code?: string
                    name?: string
                    owner_id?: string | null
                    payment_settings?: Json | null
                    modules?: Json | null
                    ranks?: Json | null
                    created_at?: string
                }
            }
            profiles: {
                Row: {
                    id: string
                    email: string | null
                    name: string | null
                    role: 'master' | 'student' | 'admin' | null
                    academy_id: string | null
                    avatar_url: string | null
                    student_id: string | null
                    created_at: string
                }
                Insert: {
                    id: string
                    email?: string | null
                    name?: string | null
                    role?: 'master' | 'student' | 'admin' | null
                    academy_id?: string | null
                    avatar_url?: string | null
                    student_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    email?: string | null
                    name?: string | null
                    role?: 'master' | 'student' | 'admin' | null
                    academy_id?: string | null
                    avatar_url?: string | null
                    student_id?: string | null
                    created_at?: string
                }
            }
            students: {
                Row: {
                    id: string
                    user_id: string | null
                    academy_id: string
                    name: string
                    email: string | null
                    cell_phone: string | null
                    age: number | null
                    birth_date: string | null
                    weight: number | null
                    height: number | null
                    blood_type: string | null
                    avatar_url: string | null
                    guardian: Json | null
                    rank_id: string | null
                    rank_current: string | null
                    stripes: number | null
                    status: string | null
                    program: string | null
                    balance: number | null
                    join_date: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    academy_id: string
                    name: string
                    email?: string | null
                    cell_phone?: string | null
                    age?: number | null
                    birth_date?: string | null
                    weight?: number | null
                    height?: number | null
                    blood_type?: string | null
                    avatar_url?: string | null
                    guardian?: Json | null
                    rank_id?: string | null
                    rank_current?: string | null
                    stripes?: number | null
                    status?: string | null
                    program?: string | null
                    balance?: number | null
                    join_date?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    academy_id?: string
                    name?: string
                    email?: string | null
                    cell_phone?: string | null
                    age?: number | null
                    birth_date?: string | null
                    weight?: number | null
                    height?: number | null
                    blood_type?: string | null
                    avatar_url?: string | null
                    guardian?: Json | null
                    rank_id?: string | null
                    rank_current?: string | null
                    stripes?: number | null
                    status?: string | null
                    program?: string | null
                    balance?: number | null
                    join_date?: string | null
                    created_at?: string
                }
            }
            tuition_records: {
                Row: {
                    id: string
                    academy_id: string
                    student_id: string
                    concept: string
                    month: string | null
                    amount: number
                    original_amount: number | null
                    penalty_amount: number | null
                    due_date: string
                    payment_date: string | null
                    status: 'pending' | 'overdue' | 'in_review' | 'paid' | 'charged' | 'partial' | null
                    method: string | null
                    proof_url: string | null
                    category: string | null
                    description: string | null
                    can_be_paid_in_parts: boolean | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    academy_id: string
                    student_id: string
                    concept: string
                    amount: number
                    status?: string | null
                    due_date: string
                    payment_date?: string | null
                    month?: string | null
                    original_amount?: number | null
                    penalty_amount?: number | null
                    method?: string | null
                    proof_url?: string | null
                    category?: string | null
                    description?: string | null
                    can_be_paid_in_parts?: boolean | null
                    created_at?: string
                }
                Update: {
                    status?: string | null
                    amount?: number
                    payment_date?: string | null
                    proof_url?: string | null
                    academy_id?: string
                    student_id?: string
                    concept?: string
                    description?: string | null
                    penalty_amount?: number | null
                    method?: string | null
                    batch_payment_id?: string | null
                    declared_amount?: number | null
                }
            }
            classes: {
                Row: {
                    id: string
                    academy_id: string
                    name: string
                    days: string[] | null
                    start_time: string
                    end_time: string
                    instructor: string
                    description: string | null
                    student_ids: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    academy_id: string
                    name: string
                    days?: string[] | null
                    start_time: string
                    end_time: string
                    instructor: string
                    description?: string | null
                    student_ids?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    academy_id?: string
                    name?: string
                    days?: string[] | null
                    start_time?: string
                    end_time?: string
                    instructor?: string
                    description?: string | null
                    student_ids?: Json | null
                    created_at?: string
                }
            }
            events: {
                Row: {
                    id: string
                    academy_id: string
                    title: string
                    start_time: string
                    end_time: string
                    description: string | null
                    instructor: string | null
                    color: string | null
                    type: string | null
                    status: string | null
                    registrants: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    academy_id: string
                    title: string
                    start_time: string
                    end_time: string
                    description?: string | null
                    instructor?: string | null
                    color?: string | null
                    type?: string | null
                    status?: string | null
                    registrants?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    academy_id?: string
                    title?: string
                    start_time?: string
                    end_time?: string
                    description?: string | null
                    instructor?: string | null
                    color?: string | null
                    type?: string | null
                    status?: string | null
                    registrants?: Json | null
                    created_at?: string
                }
            }
            library: {
                Row: {
                    id: string
                    academy_id: string
                    title: string
                    description: string | null
                    thumbnail_url: string | null
                    video_url: string | null
                    duration: string | null
                    category: string | null
                    level: string | null
                    completed_by: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    academy_id: string
                    title: string
                    description?: string | null
                    thumbnail_url?: string | null
                    video_url?: string | null
                    duration?: string | null
                    category?: string | null
                    level?: string | null
                    completed_by?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    academy_id?: string
                    title?: string
                    description?: string | null
                    thumbnail_url?: string | null
                    video_url?: string | null
                    duration?: string | null
                    category?: string | null
                    level?: string | null
                    completed_by?: Json | null
                    created_at?: string
                }
            }
            messages: {
                Row: {
                    id: string
                    academy_id: string
                    sender_id: string
                    sender_name: string
                    recipient_id: string | null
                    recipient_name: string | null
                    subject: string | null
                    content: string
                    type: string | null
                    read: boolean | null
                    date: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    academy_id: string
                    sender_id: string
                    sender_name: string
                    recipient_id?: string | null
                    recipient_name?: string | null
                    subject?: string | null
                    content: string
                    type?: string | null
                    read?: boolean | null
                    date?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    academy_id?: string
                    sender_id?: string
                    sender_name?: string
                    recipient_id?: string | null
                    recipient_name?: string | null
                    subject?: string | null
                    content?: string
                    type?: string | null
                    read?: boolean | null
                    date?: string
                    created_at?: string
                }
            }
        }
    }
}
