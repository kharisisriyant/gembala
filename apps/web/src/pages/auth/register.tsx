import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"
import { AuthShell } from "./auth-shell"

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [organizationName, setOrganizationName] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await register({ organizationName, name, email, password })
      toast.success(`${organizationName} created`, { description: "You are the organization admin." })
      navigate("/dashboard", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Create your organization"
      description="Register your church and become its admin."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-foreground font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="org">Church / organization name</Label>
          <Input
            id="org"
            placeholder="e.g. Gembala Community Church"
            required
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name">Your full name</Label>
          <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">At least 8 characters.</p>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create organization"}
        </Button>
      </form>
    </AuthShell>
  )
}
