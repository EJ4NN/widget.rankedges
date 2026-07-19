import { listContests, listServers, getBranding } from "@/app/actions/admin"
import { listAdminUsers } from "@/app/actions/users"
import { requireAdmin } from "@/lib/get-session"
import { ContestManager } from "@/components/admin/contest-manager"
import { ServerManager } from "@/components/admin/server-manager"
import { AdminsManager } from "@/components/admin/admins-manager"
import { BrandingManager } from "@/components/admin/branding-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const currentUser = await requireAdmin()
  const [contests, servers, users, branding] = await Promise.all([
    listContests(),
    listServers(),
    listAdminUsers(),
    getBranding(),
  ])

  // Distinct broker companies available for contest eligibility checkboxes.
  const brokers = Array.from(
    new Set(servers.map((s) => s.company?.trim()).filter((c): c is string => Boolean(c))),
  ).sort()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage contests, broker servers, and participants.
        </p>
      </div>

      <Tabs defaultValue="contests">
        <TabsList>
          <TabsTrigger value="contests">Contests</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="admins">Admins</TabsTrigger>
        </TabsList>
        <TabsContent value="contests" className="mt-6">
          <ContestManager contests={contests} brokers={brokers} />
        </TabsContent>
        <TabsContent value="servers" className="mt-6">
          <ServerManager servers={servers} />
        </TabsContent>
        <TabsContent value="branding" className="mt-6">
          <BrandingManager logoUrl={branding.logoUrl} coBrandUrl={branding.coBrandUrl} />
        </TabsContent>
        <TabsContent value="admins" className="mt-6">
          <AdminsManager users={users} currentUserId={currentUser.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
