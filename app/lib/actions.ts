"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { redirect } from "next/navigation";
import { signIn } from "../auth";
import { AuthError } from 'next-auth';

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};


const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({ invalid_type_error: 'Please Select a Customer.' }),
    amount: z.coerce.number().gt(0, 'Please enter an amount greater than $0.'),
    status: z.enum(["paid", "pending"], { invalid_type_error: 'Please select an invoice status' }),
    date: z.string()
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {


    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }
    const { customerId, amount, status } = validatedFields.data;

    const amounInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {

        await sql`
        insert into invoices (customer_id, amount, status, date)
        values(${customerId}, ${amounInCents}, ${status}, ${date})`;
    } catch (err) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }

    revalidatePath("/dashboard/invoices")
    redirect("/dashboard/invoices");


    // console.log(typeof rawFormData.amount)
}

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amounInCents = amount * 100;
    try {
        await sql`
    update invoices
    set customer_id =${customerId}, amount=${amounInCents}, status=${status}
    where id =${id}`;
    } catch (err) {
        console.error(err);
    }



    revalidatePath("/dashboard/invoices")
    redirect("/dashboard/invoices");

}

export async function deleteInvoice(id: string) {
    await sql`delete from invoices where id = ${id}`;

    revalidatePath("/dashboard/invoices");
}

 
export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}