import { listContests, listServers, getBranding } from "@/app/actions/admin"
import { listAdminUsers } from "@/app/actions/users"
import { getCurrentAdmin, isMaster } from "@/lib/authz"
import { ContestManager } from "@/components/admin/contest-manager"
import { ServerManager } from "@/components/admin/server-manager"
import { AdminsManager } from "@/components/admin/admins-manager"
import { BrandingManager } from "@/components/admin/branding-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const currentUser = await getCurrentAdmin()
  const master = isMaster(currentUser)

  // Contests + servers are needed for everyone (servers feed the broker
  // eligibility list when creating a contest). Master-only data (admin users,
  // branding) is fetched only for the master to avoid redirect loops.
  const [contests, servers] = await Promise.all([listContests(), listServers()])
  const [users, branding] = master
    ? await Promise.all([listAdminUsers(), getBranding()])
    : [[], { logoUrl: null, coBrandUrl: null }]

  // Distinct broker companies available for contest eligibility checkboxes.
  const brokers = Array.from(
    new Set(servers.map((s) => s.company?.trim()).filter((c): c is string => Boolean(c))),
  ).sort()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {master
            ? "Manage contests, broker servers, and participants."
            : "Manage the contests you own or have been given access to."}
        </p>
      </div>

      <Tabs defaultValue="contests">
        <TabsList>
          <TabsTrigger value="contests">Contests</TabsTrigger>
          {master && <TabsTrigger value="servers">Servers</TabsTrigger>}
          {master && <TabsTrigger value="branding">Branding</TabsTrigger>}
          {master && <TabsTrigger value="admins">Admins</TabsTrigger>}
        </TabsList>
        <TabsContent value="contests" className="mt-6">
          <ContestManager contests={contests} brokers={brokers} />
        </TabsContent>
        {master && (
          <>
            <TabsContent value="servers" className="mt-6">
              <ServerManager servers={servers} />
            </TabsContent>
            <TabsContent value="branding" className="mt-6">
              <BrandingManager logoUrl={branding.logoUrl} coBrandUrl={branding.coBrandUrl} />
            </TabsContent>
            <TabsContent value="admins" className="mt-6">
              <AdminsManager users={users} currentUserId={currentUser.id} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
