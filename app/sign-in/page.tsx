import { redirect } from "next/navigation"
import { getSession } from "@/lib/get-session"
import { AuthForm } from "@/components/auth-form"

export default async function SignInPage() {
  const session = await getSession()
  if (session?.user) redirect("/admin")
  return <AuthForm mode="sign-in" />
}
