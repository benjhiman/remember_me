'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Building2, Plug, User, LogOut, Save } from 'lucide-react';
import Link from 'next/link';
import { Permission, userCan } from '@/lib/auth/permissions';
import { usePermissions } from '@/lib/auth/use-permissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrgSettings, useUpdateOrgSettings } from '@/lib/api/hooks/use-org-settings';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';

export default function SettingsPage() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { toast } = useToast();
  const { can } = usePermissions();

  const { data: orgSettings, isLoading, error } = useOrgSettings(!!user);
  const update = useUpdateOrgSettings();
  const canEdit = can('settings.write');

  const [local, setLocal] = useState<any>(null);

  useEffect(() => {
    if (orgSettings && !local) setLocal(orgSettings);
  }, [orgSettings, local]);

  const isDirty = useMemo(() => {
    if (!orgSettings || !local) return false;
    return JSON.stringify(orgSettings) !== JSON.stringify(local);
  }, [orgSettings, local]);

  // Auth is handled by RouteGuard in layout
  // No need to check here to avoid double redirects

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  const onSave = async () => {
    if (!local) return;
    try {
      await update.mutateAsync(local);
      toast({ title: 'Guardado', description: 'Configuración actualizada' });
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e), variant: 'destructive' as any });
    }
  };

  const breadcrumbs = [
    { label: 'Settings', href: '/settings' },
  ];

  const actions = (
    <Button onClick={onSave} disabled={!canEdit || !isDirty || update.isPending || !local} size="sm">
      <Save className="h-4 w-4 mr-2" />
      {update.isPending ? 'Guardando…' : 'Guardar'}
    </Button>
  );

  return (
    <PageShell
      title="Settings"
      description={
        !canEdit
          ? 'Configuración por organización (SaaS). Solo OWNER / ADMIN pueden guardar cambios.'
          : 'Configuración por organización (SaaS)'
      }
      breadcrumbs={breadcrumbs}
      actions={actions}
    >

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="permisos">Permisos</TabsTrigger>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
          {userCan(user, Permission.MANAGE_MEMBERS) && (
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  <CardTitle>Organización</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Nombre</div>
                  <div className="font-medium">{user.organizationName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Rol</div>
                  <div className="font-medium">{user.role}</div>
                </div>
              </CardContent>
            </Card>

            {userCan(user, Permission.VIEW_INTEGRATIONS) && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Plug className="h-5 w-5" />
                    <CardTitle>Integraciones</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Estado real, tests y activity (Meta / Instagram / WhatsApp).
                  </p>
                  <Link href="/settings/integrations">
                    <Button variant="outline" className="w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      Abrir Integraciones
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <CardTitle>Mi cuenta</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Email</div>
                    <div className="font-medium">{user.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Nombre</div>
                    <div className="font-medium">{user.name || 'No especificado'}</div>
                  </div>
                </div>
                <Button variant="outline" onClick={handleLogout} className="w-full">
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="permisos">
          <Card>
            <CardHeader>
              <CardTitle>Permisos (por organización)</CardTitle>
              <CardDescription>
                Toggles tipo SaaS real. Estos flags gobiernan la lógica (backend + UI).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading && <div className="text-sm text-gray-500">Cargando…</div>}
              {error && <div className="text-sm text-red-600">{getErrorMessage(error)}</div>}
              {local && (
                <div className="space-y-4">
                  {[
                    {
                      key: 'sellerCanChangeConversationStatus',
                      label: 'Permitir que vendedores cambien el estado del chat',
                      desc: 'Solo en chats asignados a ellos (si Inbox lo restringe).',
                    },
                    {
                      key: 'sellerCanReassignConversation',
                      label: 'Permitir que vendedores reasignen chats',
                      desc: 'Recomendado: solo reasignación a sí mismos.',
                    },
                    {
                      key: 'sellerCanEditSales',
                      label: 'Permitir que vendedores creen/editen ventas',
                      desc: 'Aplica a crear y editar ventas.',
                    },
                    {
                      key: 'sellerCanEditLeads',
                      label: 'Permitir que vendedores creen/editen leads',
                      desc: 'Aplica a create/update lead.',
                    },
                    {
                      key: 'sellerCanMoveKanban',
                      label: 'Permitir que vendedores muevan el Kanban',
                      desc: 'Controla cambios de stage/pipeline en leads.',
                    },
                  ].map((item) => (
                    <div key={item.key} className="flex items-start justify-between gap-4 rounded-lg border bg-white p-4">
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-sm text-gray-600">{item.desc}</div>
                      </div>
                      <Switch
                        checked={!!local.crm.permissions[item.key]}
                        onCheckedChange={(v) =>
                          setLocal((prev: any) => ({
                            ...prev,
                            crm: {
                              ...prev.crm,
                              permissions: { ...prev.crm.permissions, [item.key]: v },
                            },
                          }))
                        }
                        disabled={!canEdit}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbox">
          <Card>
            <CardHeader>
              <CardTitle>Inbox</CardTitle>
              <CardDescription>Reglas operativas del centro de conversaciones.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {local && (
                <>
                  <div className="flex items-start justify-between gap-4 rounded-lg border bg-white p-4">
                    <div className="flex-1">
                      <div className="font-medium">Auto-assign al responder</div>
                      <div className="text-sm text-gray-600">
                        Si un usuario responde, asignar el chat automáticamente.
                      </div>
                    </div>
                    <Switch
                      checked={!!local.crm.inbox.autoAssignOnReply}
                      onCheckedChange={(v) =>
                        setLocal((prev: any) => ({
                          ...prev,
                          crm: { ...prev.crm, inbox: { ...prev.crm.inbox, autoAssignOnReply: v } },
                        }))
                      }
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 rounded-lg border bg-white p-4">
                    <div className="flex-1">
                      <div className="font-medium">Restringir SELLER a sus chats</div>
                      <div className="text-sm text-gray-600">
                        Si está activo, vendedores solo ven conversaciones asignadas a ellos.
                      </div>
                    </div>
                    <Switch
                      checked={!!local.crm.inbox.sellerSeesOnlyAssigned}
                      onCheckedChange={(v) =>
                        setLocal((prev: any) => ({
                          ...prev,
                          crm: { ...prev.crm, inbox: { ...prev.crm.inbox, sellerSeesOnlyAssigned: v } },
                        }))
                      }
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="rounded-lg border bg-white p-4">
                    <div className="font-medium mb-1">Estado default de conversación</div>
                    <div className="text-sm text-gray-600 mb-3">
                      Se aplica al crear una conversación nueva (primer mensaje).
                    </div>
                    <Select
                      value={local.crm.inbox.defaultConversationStatus}
                      onValueChange={(v) =>
                        setLocal((prev: any) => ({
                          ...prev,
                          crm: { ...prev.crm, inbox: { ...prev.crm.inbox, defaultConversationStatus: v } },
                        }))
                      }
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN">OPEN</SelectItem>
                        <SelectItem value="PENDING">PENDING</SelectItem>
                        <SelectItem value="CLOSED">CLOSED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apariencia">
          <Card>
            <CardHeader>
              <CardTitle>Apariencia</CardTitle>
              <CardDescription>
                Preparado para dark mode y densidad tipo CRM enterprise.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {local && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border bg-white p-4 md:col-span-3">
                    <div className="font-medium mb-2">White‑label (Branding)</div>
                    <div className="text-sm text-gray-600 mb-4">
                      Nombre, logo y favicon por organización.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Nombre del CRM</label>
                        <Input
                          value={local.crm.branding?.name || ''}
                          onChange={(e) =>
                            setLocal((prev: any) => ({
                              ...prev,
                              crm: { ...prev.crm, branding: { ...(prev.crm.branding || {}), name: e.target.value } },
                            }))
                          }
                          placeholder={`${user.organizationName} CRM`}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Logo URL (opcional)</label>
                        <Input
                          value={local.crm.branding?.logoUrl || ''}
                          onChange={(e) =>
                            setLocal((prev: any) => ({
                              ...prev,
                              crm: { ...prev.crm, branding: { ...(prev.crm.branding || {}), logoUrl: e.target.value || null } },
                            }))
                          }
                          placeholder="https://..."
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Favicon URL (opcional)</label>
                        <Input
                          value={local.crm.branding?.faviconUrl || ''}
                          onChange={(e) =>
                            setLocal((prev: any) => ({
                              ...prev,
                              crm: { ...prev.crm, branding: { ...(prev.crm.branding || {}), faviconUrl: e.target.value || null } },
                            }))
                          }
                          placeholder="https://..."
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-3">
                      Tip: si cambiás el favicon, puede tardar en reflejarse por cache del navegador.
                    </div>
                  </div>

                  <div className="rounded-lg border bg-white p-4">
                    <div className="font-medium mb-2">Density</div>
                    <Select
                      value={local.crm.ui.density}
                      onValueChange={(v) =>
                        setLocal((prev: any) => ({
                          ...prev,
                          crm: {
                            ...prev.crm,
                            ui: { ...prev.crm.ui, density: v },
                            branding: { ...(prev.crm.branding || {}), density: v },
                          },
                        }))
                      }
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comfortable">comfortable</SelectItem>
                        <SelectItem value="compact">compact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg border bg-white p-4">
                    <div className="font-medium mb-2">Accent</div>
                    <Select
                      value={local.crm.ui.accentColor}
                      onValueChange={(v) =>
                        setLocal((prev: any) => ({
                          ...prev,
                          crm: {
                            ...prev.crm,
                            ui: { ...prev.crm.ui, accentColor: v },
                            branding: { ...(prev.crm.branding || {}), accentColor: v },
                          },
                        }))
                      }
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blue">blue</SelectItem>
                        <SelectItem value="violet">violet</SelectItem>
                        <SelectItem value="green">green</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg border bg-white p-4">
                    <div className="font-medium mb-2">Theme (prep)</div>
                    <Select
                      value={local.crm.ui.theme}
                      onValueChange={(v) =>
                        setLocal((prev: any) => ({
                          ...prev,
                          crm: { ...prev.crm, ui: { ...prev.crm.ui, theme: v } },
                        }))
                      }
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">light</SelectItem>
                        <SelectItem value="dark">dark</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-gray-500 mt-2">
                      Dark mode completo se implementa en un siguiente release.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {userCan(user, Permission.MANAGE_MEMBERS) && (
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>
                  Registro completo de actividades del sistema. Solo visible para ADMIN/OWNER/MANAGER.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/settings/audit">
                  <Button variant="outline" className="w-full">
                    Ver Audit Log completo
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </PageShell>
  );
}
