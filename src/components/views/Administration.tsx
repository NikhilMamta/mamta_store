import { Eye, EyeClosed, Pencil, ShieldUser, Trash, UserPlus, Lock, Shield, Layout, ClipboardList, ShoppingCart, Truck, Package, Key } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import { fetchFromDB, postToDB } from '@/lib/fetchers';
import { allPermissionKeys, type UserPermissions } from '@/types/database';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { useAuth } from '@/context/AuthContext';
import {
    Dialog,
    DialogClose,
    DialogContent,
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

function camelToTitleCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (char) => char.toUpperCase());
}

const PERMISSION_GROUPS = [
    {
        name: 'General',
        icon: <Layout size={16} />,
        keys: ['dashboard', 'inventory', 'administrate']
    },
    {
        name: 'Indent Management',
        icon: <ClipboardList size={16} />,
        keys: ['createIndent', 'allIndent', 'indentApprovalView', 'indentApprovalAction', 'pendingIndentsView']
    },
    {
        name: 'Purchase (PO)',
        icon: <ShoppingCart size={16} />,
        keys: ['createPo', 'poMaster', 'ordersView', 'getPurchase', 'quotation']
    },
    {
        name: 'Vendor & Quality',
        icon: <Shield size={16} />,
        keys: ['updateVendorView', 'updateVendorAction', 'threePartyApprovalView', 'threePartyApprovalAction']
    },
    {
        name: 'Store & Logistic',
        icon: <Truck size={16} />,
        keys: ['receiveItemView', 'receiveItemAction', 'storeOutApprovalView', 'storeOutApprovalAction']
    },
    {
        name: 'Utilities',
        icon: <Key size={16} />,
        keys: ['trainingVideo', 'license']
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
        fetchFromDB('USER').then((res) => {
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
                            <Pill key={i}>{camelToTitleCase(perm)}</Pill>
                        ))}
                        {permissions.length > 3 && (
                            <HoverCard>
                                <HoverCardTrigger>
                                    <Pill className="cursor-pointer bg-muted text-muted-foreground">+{permissions.length - 3} more</Pill>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80 flex flex-wrap gap-1 p-3">
                                    {permissions.map((perm, i) => (
                                        <Pill key={i}>{camelToTitleCase(perm)}</Pill>
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
                                    await postToDB([{ id: user.id }], 'delete', 'USER');
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
    useEffect(() => {
        if (selectedRole === 'Admin') {
            form.setValue('permissions', [...allPermissionKeys]);
        }
    }, [selectedRole, form]);

    useEffect(() => {
        if (selectedUser) {
            const isAdmin = selectedUser.permissions.length === allPermissionKeys.length;
            form.reset({
                username: selectedUser.username,
                name: selectedUser.name,
                password: selectedUser.password,
                role: isAdmin ? 'Admin' : 'User',
                permissions: selectedUser.permissions,
            });
        } else {
            form.reset({ name: '', username: '', password: '', role: 'User', permissions: [] });
        }
    }, [selectedUser, form]);

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

            await postToDB([row], isEdit ? 'update' : 'insert', 'USER');

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
                        <DialogTitle className="text-xl flex items-center gap-2">
                            {selectedUser ? <Pencil size={20} /> : <UserPlus size={20} />}
                            {selectedUser ? 'Edit User Access' : 'Create New System User'}
                        </DialogTitle>
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

                            <section className="space-y-4">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Module Access Permissions</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    {PERMISSION_GROUPS.map((group) => (
                                        <div key={group.name} className="space-y-3">
                                            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                                {group.icon} {group.name}
                                            </div>
                                            <div className="space-y-2 pl-6">
                                                {group.keys.map((perm) => (
                                                    <FormField
                                                        key={perm}
                                                        control={form.control}
                                                        name="permissions"
                                                        render={({ field }) => (
                                                            <div className="flex items-center justify-between py-1 border-b border-muted last:border-0">
                                                                <label htmlFor={perm} className="text-xs font-medium cursor-pointer">{camelToTitleCase(perm)}</label>
                                                                <Checkbox
                                                                    id={perm}
                                                                    checked={field.value?.includes(perm)}
                                                                    onCheckedChange={(checked) => {
                                                                        const current = field.value || [];
                                                                        field.onChange(checked ? [...current, perm] : current.filter(p => p !== perm));
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
