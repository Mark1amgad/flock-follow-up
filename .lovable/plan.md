

# Church Follow-Up Committee App

## Overview
A secure web application for managing church follow-up activities, with role-based dashboards for committee members and admins, weekly random assignments, attendance tracking, and WhatsApp integration.

---

## 1. Authentication & User Management
- Email + password sign-up/login via Supabase Auth
- Forgot/reset password flow
- User profiles table linked to auth (name, gender)
- Separate `user_roles` table for secure role management (admin/member)
- Protected routes — redirect unauthenticated users to login

## 2. Member Dashboard
- After login, members see **only their assigned people** for the current week
- Each person displayed as a card showing:
  - Full Name, Phone, Gender, Last Attendance Date
  - **WhatsApp button** — auto-converts Egyptian phone numbers (e.g., `01012345678` → `201012345678`) and opens `https://wa.me/{formatted_phone}`
- Clean, mobile-friendly card layout

## 3. Admin Dashboard
### People Management
- Add, edit, and delete people (name, phone, gender)
- Searchable list of all people

### Attendance Tracking
- Search for a person by name
- "Mark as Present Today" button per person
- Records attendance date and updates `last_attendance_date`

### Weekly Assignment Generator
- "Generate Weekly Assignment" button
- Randomly assigns people to committee members with **gender matching** (males → male members, females → female members)
- Balanced distribution across members
- Saved with `week_start_date` — assignments stay fixed for the week
- Prevents accidental re-generation (confirmation prompt)

### Dashboard Stats
- Total people count
- Present this week / Absent this week
- Filters: absent 1 week, absent 3+ weeks

## 4. Database Schema (Supabase)
- **profiles** — id, name, gender (linked to auth.users)
- **user_roles** — user_id, role (admin/member) — separate table for security
- **people** — id, name, phone, gender, last_attendance_date
- **attendance** — id, person_id, date
- **weekly_assignments** — id, servant_id, person_id, week_start_date

## 5. Security (Row-Level Security)
- `people` table: admin full access; members no direct access
- `weekly_assignments`: members can only read their own assignments
- `attendance`: admin can insert/read; members read-only for their assigned people
- `user_roles`: secured via security-definer function to prevent recursion
- No public database access

## 6. UI & Design
- Modern, clean church-appropriate design with warm colors
- Responsive layout optimized for mobile use
- Separate admin and member views based on role
- Card-based layout for assigned people
- Search bars, action buttons, and stat counters on admin dashboard

