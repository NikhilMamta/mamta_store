import { Eye, EyeClosed, Pencil, ShieldUser, Trash, UserPlus, Lock, Shield, Layout, ClipboardList, ShoppingCart, Truck, Package, Key } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState, useMemo, useRef } from 'react';
import { fetchSheet, postToSheet } from '@/lib/fetchers';
import { allPermissionKeys, type UserPermissions } from '@/types/sheets';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { useAuth } from '@/context/AuthContext';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import { Pill } from '../ui/pill';

interface UsersTableData {
    username: string;
    name: string;
    password: string;
    permissions: string[];
    id?: number;
}

function formatPermissionLabel(str: string): string {
    return str
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

const PERMISSION_GROUPS = [
    {
        name: 'Core System',
        icon: <Layout size={18} className="text-indigo-600" />,
        permissions: [
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'inventory', label: 'Inventory' },
            { key: 'administration', label: 'Administration' },
        ]
    },
    {
        name: 'Indent Workflow',
        icon: <ClipboardList size={18} className="text-amber-600" />,
        permissions: [
            { key: 'create_indent', label: 'Create Indent' },
            { key: 'approve_indent', label: 'Approve Indent' },
        ]
    },
    {
        name: 'Purchase Management',
        icon: <ShoppingCart size={18} className="text-emerald-600" />,
        permissions: [
            { key: 'create_po', label: 'Create PO' },
            { key: 'po_approval', label: 'PO Approval' },
            { key: 'po_history', label: 'PO History' },
            { key: 'pending_pos', label: 'Pending POs' },
            { key: 'quotation', label: 'Quotation' },
        ]
    },
    {
        name: 'Store & Logistics',
        icon: <Truck size={18} className="text-blue-600" />,
        permissions: [
            { key: 'receive_items', label: 'Receive Items' },
            { key: 'store_out_approval', label: 'Store Out Approval' },
            { key: 'store_out', label: 'Store Out' },
        ]
    },
    {
        name: 'Vendor & Quality',
        icon: <Shield size={18} className="text-rose-600" />,
        permissions: [
            { key: 'vendor_rate_update', label: 'Vendor Rate Update' },
            { key: 'three_party_approval', label: 'Three Party Approval' },
        ]
    },
    {
        name: 'System Utilities',
        icon: <Key size={18} className="text-slate-600" />,
        permissions: [
            { key: 'master_data', label: 'Master Data' },
            { key: 'training_video', label: 'Training Video' },
            { key: 'license', label: 'License' },
        ]
    }
];

export default () => {
    const { user: currentUser } = useAuth();
    const [tableData, setTableData] = useState<UsersTableData[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UsersTableData | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    function fetchUser() {
        setDataLoading(true);
        fetchSheet('USER').then((res) => {
            setTableData(
                (res as any[]).map((user) => {
                    const permissionKeys = allPermissionKeys.filter(
                        (key) => user[key] === true || user[key] === 'TRUE'
                    );
                    return {
                        username: user.username,
                        name: user.name,
                        password: user.password,
                        permissions: permissionKeys as string[],
                        id: user.id,
                    };
                })
            );
            setDataLoading(false);
        });
    }

    useEffect(() => {
        fetchUser();
    }, []);

    const columns: ColumnDef<UsersTableData>[] = [
        { 
            accessorKey: 'name', 
            header: 'Full Name',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <span className="font-medium">{row.original.name}</span>
                    {row.original.username === 'admin' && <Pill className="bg-primary/10 text-primary border-primary/20">Admin</Pill>}
                </div>
            )
        },
        { accessorKey: 'username', header: 'Username' },
        {
            accessorKey: 'permissions',
            header: 'Permissions',
            cell: ({ row }) => {
                const permissions = row.original.permissions;
                return (
                    <div className="flex flex-wrap gap-1">
                        {permissions.slice(0, 3).map((perm, i) => (
                            <Pill key={i}>{formatPermissionLabel(perm)}</Pill>
                        ))}
                        {permissions.length > 3 && (
                            <HoverCard>
                                <HoverCardTrigger>
                                    <Pill className="cursor-pointer bg-muted text-muted-foreground">+{permissions.length - 3} more</Pill>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80 flex flex-wrap gap-1 p-3">
                                    {permissions.map((perm, i) => (
                                        <Pill key={i}>{formatPermissionLabel(perm)}</Pill>
                                    ))}
                                </HoverCardContent>
                            </HoverCard>
                        )}
                    </div>
                );
            },
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                const user = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-2 flex items-center gap-1"
                            onClick={() => {
                                setSelectedUser(user);
                                setOpenDialog(true);
                            }}
                        >
                            <Pencil size={14} /> Edit
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            disabled={user.username === 'admin'}
                            onClick={async () => {
                                if (confirm(`Delete ${user.name}?`)) {
                                    await postToSheet([{ id: user.id }], 'delete', 'USER');
                                    fetchUser();
                                }
                            }}
                        >
                            <Trash size={14} />
                        </Button>
                    </div>
                );
            },
        },
    ];

    const schema = z.object({
        name: z.string().min(2),
        username: z.string().min(3),
        password: z.string().min(4),
        role: z.enum(['Admin', 'User']).default('User'),
        permissions: z.array(z.string()),
    });

    const form = useForm({ 
        resolver: zodResolver(schema),
        defaultValues: { name: '', username: '', password: '', role: 'User', permissions: [] }
    });

    const selectedRole = form.watch('role');
    const permissions = form.watch('permissions') || [];

    // Automatically set all permissions for Admin role
    useEffect(() => {
        if (selectedRole === 'Admin') {
            const currentPerms = form.getValues('permissions') || [];
            if (currentPerms.length !== allPermissionKeys.length) {
                form.setValue('permissions', [...allPermissionKeys]);
            }
        }
    }, [selectedRole, form]);

    // Handle initial state and user selection
    const lastSelectedUserId = useRef<string | null>(null);
    useEffect(() => {
        if (selectedUser) {
            if (lastSelectedUserId.current !== selectedUser.id) {
                lastSelectedUserId.current = selectedUser.id;
                form.reset({
                    name: selectedUser.name,
                    username: selectedUser.username,
                    password: selectedUser.password,
                    role: selectedUser.permissions.length === allPermissionKeys.length ? 'Admin' : 'User',
                    permissions: selectedUser.permissions,
                });
            }
        } else if (lastSelectedUserId.current !== null) {
            lastSelectedUserId.current = null;
            form.reset({ name: '', username: '', password: '', role: 'User', permissions: [] });
        }
    }, [selectedUser, form]);

    const allDisplayedKeys = useMemo(() => PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key)), []);
    const isAllSelected = allDisplayedKeys.every(k => permissions.includes(k));

    async function onSubmit(value: z.infer<typeof schema>) {
        const isEdit = !!selectedUser;
        try {
            const row: any = {
                username: value.username,
                name: value.name,
                password: value.password,
            };
            if (isEdit) row.id = selectedUser!.id;

            // Set all permission flags (true/false)
            allPermissionKeys.forEach((perm) => {
                row[perm] = value.permissions.includes(perm);
            });

            await postToSheet([row], isEdit ? 'update' : 'insert', 'USER');

            toast.success(isEdit ? `✅ ${value.name} updated successfully` : `✅ ${value.name} created successfully`);
            setOpenDialog(false);
            form.reset({ name: '', username: '', password: '', role: 'User', permissions: [] });
            setSelectedUser(null);

            // Small delay to allow Supabase to commit before re-fetching
            setTimeout(() => fetchUser(), 800);
        } catch (error) {
            console.error('User save error:', error);
            toast.error('❌ Failed to save user. Please try again.');
        }
    }

    return (
        <div className="space-y-6">
            <Heading heading="Administration" subtext="User Management">
                <ShieldUser size={50} className="text-primary" />
            </Heading>

            <div className="bg-card border rounded-lg overflow-hidden">
                <DataTable
                    data={tableData}
                    columns={columns}
                    searchFields={['name', 'username']}
                    dataLoading={dataLoading}
                    extraActions={
                        <Button
                            className="gap-2"
                            onClick={() => {
                                setSelectedUser(null);
                                setOpenDialog(true);
                            }}
                        >
                            <UserPlus size={18} />
                            Create New User
                        </Button>
                    }
                />
            </div>

            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            {selectedUser ? <Pencil className="text-primary" /> : <UserPlus className="text-primary" />}
                            {selectedUser ? 'Edit User Access' : 'Create New User'}
                        </DialogTitle>
                        <DialogDescription className="hidden">
                            Manage permissions and account details for {selectedUser ? selectedUser.name : 'new user'}.
                        </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            <div className="grid md:grid-cols-4 gap-6">
                                <FormField
                                    control={form.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>User Role</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Admin">Admin (Full Access)</SelectItem>
                                                    <SelectItem value="User">Regular User</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Full Name</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Username</FormLabel>
                                            <FormControl><Input {...field} disabled={selectedUser?.username === 'admin'} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input type={showPassword ? 'text' : 'password'} {...field} />
                                                    <Button variant="ghost" type="button" className="absolute right-0 top-0" onClick={() => setShowPassword(!showPassword)}>
                                                        {showPassword ? <EyeClosed size={16} /> : <Eye size={16} />}
                                                    </Button>
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <section className="space-y-6 pt-2">
                                <div className="flex items-center justify-between border-b pb-4">
                                    <div>
                                        <h4 className="text-lg font-bold text-foreground">Module Access Permissions</h4>
                                        <p className="text-xs text-muted-foreground mt-1 font-medium italic">Enable specific page access for this user account</p>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="h-8 text-[11px] font-bold uppercase tracking-wider px-4 rounded-lg border-muted-foreground/20 hover:border-primary/50 transition-all"
                                            onClick={() => {
                                                if (isAllSelected) {
                                                    // Unselect only the ones currently displayed
                                                    form.setValue('permissions', permissions.filter(p => !allDisplayedKeys.includes(p)), { 
                                                        shouldValidate: true, 
                                                        shouldDirty: true 
                                                    });
                                                } else {
                                                    // Select all displayed keys, keeping any hidden ones
                                                    const newPermissions = Array.from(new Set([...permissions, ...allDisplayedKeys]));
                                                    form.setValue('permissions', newPermissions, { 
                                                        shouldValidate: true, 
                                                        shouldDirty: true 
                                                    });
                                                }
                                            }}
                                        >
                                            {isAllSelected ? 'Unselect All' : 'Select All'}
                                        </Button>
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10">
                                            <Shield size={14} className="text-primary" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Secure Access Control</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {PERMISSION_GROUPS.map((group) => (
                                        <div key={group.name} className="flex flex-col h-full bg-muted/30 rounded-xl border border-muted-foreground/5 overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm">
                                            <div className="flex items-center gap-3 p-3 bg-muted/50 border-b border-muted-foreground/10">
                                                <div className="p-1.5 bg-white rounded-lg shadow-sm border border-muted">
                                                    {group.icon}
                                                </div>
                                                <h5 className="font-bold text-sm tracking-tight">{group.name}</h5>
                                            </div>
                                            <div className="p-4 space-y-3 flex-1">
                                                {group.permissions.map((perm) => (
                                                    <FormField
                                                        key={perm.key}
                                                        control={form.control}
                                                        name="permissions"
                                                        render={({ field }) => (
                                                            <div className="flex items-center justify-between group/item">
                                                                <label 
                                                                    htmlFor={perm.key} 
                                                                    className="text-[13px] font-medium text-muted-foreground group-hover/item:text-foreground cursor-pointer transition-colors"
                                                                >
                                                                    {perm.label}
                                                                </label>
                                                                <Checkbox
                                                                    id={perm.key}
                                                                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all duration-300"
                                                                    checked={field.value?.includes(perm.key)}
                                                                    onCheckedChange={(checked) => {
                                                                        const current = field.value || [];
                                                                        field.onChange(checked ? [...current, perm.key] : current.filter(p => p !== perm.key));
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <DialogFooter>
                                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? <Loader size={18} /> : (selectedUser ? 'Save Changes' : 'Create User Account')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
