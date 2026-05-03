import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Heading from '../element/Heading';
import { Database, Building2, Users, Layers, MapPin, Plus, Trash2, Building, RefreshCw, Pencil } from 'lucide-react';
import { useDatabase } from '@/context/DatabaseContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface MasterRow {
    id?: string | number;
    vendor_name?: string;
    vendor_gstin?: string;
    vendor_address?: string;
    vendor_email?: string;
    payment_term?: string;
    department?: string;
    group_head?: string;
    item_name?: string;
    ward_name?: string;
    unit_of_measurement?: string;
    approved_by?: string;
    company_name?: string;
    company_address?: string;
    company_email?: string;
    company_gstin?: string;
    company_phone?: string;
    billing_address?: string;
    company_pan?: string;
    destination_address?: string;
    default_terms?: string;
}

export default function MasterData() {
    const { updateMasterData } = useDatabase();
    const [masterData, setMasterData] = useState<MasterRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState<string | null>(null);
    const [form, setForm] = useState<Record<string, string>>({});
    const [editingRow, setEditingRow] = useState<MasterRow | null>(null);
    const [saving, setSaving] = useState(false);

    async function fetchMaster() {
        setLoading(true);
        const { data, error } = await supabase.from('master').select('*');
        if (error) { toast.error('Failed to load master data'); }
        else setMasterData(data || []);
        setLoading(false);
    }

    useEffect(() => { fetchMaster(); }, []);

    async function saveRow(fields: Record<string, string>) {
        setSaving(true);
        let res;
        if (editingRow && editingRow.id) {
            res = await supabase.from('master').update(fields).eq('id', editingRow.id);
        } else {
            res = await supabase.from('master').insert([fields]);
        }

        if (res.error) { toast.error('Failed to save: ' + res.error.message); }
        else {
            toast.success(editingRow ? '✅ Updated successfully' : '✅ Saved successfully');
            setEditingRow(null);
            fetchMaster();
            updateMasterData();
        }
        setSaving(false);
    }

    async function deleteRow(row: MasterRow) {
        if (!row.id) return;
        const displayName = row.vendor_name || row.department || row.item_name || row.ward_name || row.company_name || 'this item';
        if (!confirm(`Delete "${displayName}"?`)) return;
        const { error } = await supabase.from('master').delete().eq('id', row.id);
        if (error) toast.error('Delete failed');
        else { 
            toast.success('Deleted'); 
            fetchMaster(); 
            updateMasterData();
        }
    }

    const unique = (field: keyof MasterRow) =>
        [...new Set(masterData.map(r => r[field]).filter(Boolean))] as string[];

    const LoadingRows = ({ cols }: { cols: number }) => (
        <>
            {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                    {Array.from({ length: cols }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Heading heading="Master Data" subtext="Manage vendors, departments, items and company settings">
                    <Database size={50} className="text-primary" />
                </Heading>
                <Button variant="outline" size="sm" onClick={fetchMaster} className="gap-2">
                    <RefreshCw size={16} /> Refresh
                </Button>
            </div>

            <Tabs defaultValue="vendors">
                <TabsList className="flex flex-wrap gap-1 h-auto">
                    <TabsTrigger value="vendors" className="gap-1"><Users size={14} /> Vendors</TabsTrigger>
                    <TabsTrigger value="departments" className="gap-1"><Building2 size={14} /> Departments</TabsTrigger>
                    <TabsTrigger value="items" className="gap-1"><Layers size={14} /> Items</TabsTrigger>
                    <TabsTrigger value="wards" className="gap-1"><MapPin size={14} /> Ward Names</TabsTrigger>
                    <TabsTrigger value="company" className="gap-1"><Building size={14} /> Company Info</TabsTrigger>
                </TabsList>

                {/* ── VENDORS ── */}
                <TabsContent value="vendors" className="mt-4">
                    <div className="bg-card border rounded-lg">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-semibold text-sm">Vendor List</h3>
                            <Button size="sm" className="gap-1" onClick={() => { setForm({}); setEditingRow(null); setOpenDialog('vendor'); }}>
                                <Plus size={14} /> Add Vendor
                            </Button>
                        </div>
                        <ScrollArea className="h-[60vh]">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-primary text-primary-foreground">
                                    <TableRow>
                                        <TableHead>Vendor Name</TableHead>
                                        <TableHead>GSTIN</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Address</TableHead>
                                        <TableHead className="w-24">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? <LoadingRows cols={5} /> :
                                        masterData.filter(r => r.vendor_name).map((r, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{r.vendor_name}</TableCell>
                                                <TableCell>{r.vendor_gstin}</TableCell>
                                                <TableCell>{r.vendor_email}</TableCell>
                                                <TableCell className="max-w-xs truncate">{r.vendor_address}</TableCell>
                                                <TableCell className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="text-primary h-7 w-7 p-0"
                                                        onClick={() => { setEditingRow(r); setForm(r as any); setOpenDialog('vendor'); }}>
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0"
                                                        onClick={() => deleteRow(r)}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    }
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </TabsContent>

                {/* ── DEPARTMENTS ── */}
                <TabsContent value="departments" className="mt-4">
                    <div className="bg-card border rounded-lg">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-semibold text-sm">Departments</h3>
                            <Button size="sm" className="gap-1" onClick={() => { setForm({}); setEditingRow(null); setOpenDialog('department'); }}>
                                <Plus size={14} /> Add Department
                            </Button>
                        </div>
                        <ScrollArea className="h-[60vh]">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-primary text-primary-foreground">
                                    <TableRow>
                                        <TableHead>Department Name</TableHead>
                                        <TableHead className="w-24">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? <LoadingRows cols={2} /> :
                                        unique('department').map((dep, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{dep}</TableCell>
                                                <TableCell className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="text-primary h-7 w-7 p-0"
                                                        onClick={() => { 
                                                            const r = masterData.find(x => x.department === dep);
                                                            if (r) { setEditingRow(r); setForm(r as any); setOpenDialog('department'); }
                                                        }}>
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0"
                                                        onClick={() => {
                                                            const r = masterData.find(x => x.department === dep);
                                                            if (r) deleteRow(r);
                                                        }}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    }
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </TabsContent>

                {/* ── ITEMS ── */}
                <TabsContent value="items" className="mt-4">
                    <div className="bg-card border rounded-lg">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-semibold text-sm">Items / Group Heads</h3>
                            <Button size="sm" className="gap-1" onClick={() => { setForm({}); setEditingRow(null); setOpenDialog('item'); }}>
                                <Plus size={14} /> Add Item
                            </Button>
                        </div>
                        <ScrollArea className="h-[60vh]">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-primary text-primary-foreground">
                                    <TableRow>
                                        <TableHead>Group Head</TableHead>
                                        <TableHead>Item Name</TableHead>
                                        <TableHead>UOM</TableHead>
                                        <TableHead className="w-24">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? <LoadingRows cols={4} /> :
                                        masterData.filter(r => r.item_name).map((r, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{r.group_head}</TableCell>
                                                <TableCell className="font-medium">{r.item_name}</TableCell>
                                                <TableCell>{r.unit_of_measurement}</TableCell>
                                                <TableCell className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="text-primary h-7 w-7 p-0"
                                                        onClick={() => { setEditingRow(r); setForm(r as any); setOpenDialog('item'); }}>
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0"
                                                        onClick={() => deleteRow(r)}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    }
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </TabsContent>

                {/* ── WARD NAMES ── */}
                <TabsContent value="wards" className="mt-4">
                    <div className="bg-card border rounded-lg">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-semibold text-sm">Ward / Floor Names</h3>
                            <Button size="sm" className="gap-1" onClick={() => { setForm({}); setEditingRow(null); setOpenDialog('ward'); }}>
                                <Plus size={14} /> Add Ward
                            </Button>
                        </div>
                        <ScrollArea className="h-[60vh]">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-primary text-primary-foreground">
                                    <TableRow>
                                        <TableHead>Ward / Floor Name</TableHead>
                                        <TableHead className="w-24">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? <LoadingRows cols={2} /> :
                                        unique('ward_name').map((ward, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{ward}</TableCell>
                                                <TableCell className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="text-primary h-7 w-7 p-0"
                                                        onClick={() => { 
                                                            const r = masterData.find(x => x.ward_name === ward);
                                                            if (r) { setEditingRow(r); setForm(r as any); setOpenDialog('ward'); }
                                                        }}>
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0"
                                                        onClick={() => {
                                                            const r = masterData.find(x => x.ward_name === ward);
                                                            if (r) deleteRow(r);
                                                        }}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    }
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </TabsContent>

                {/* ── COMPANY INFO ── */}
                <TabsContent value="company" className="mt-4">
                    <div className="bg-card border rounded-lg p-6 space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="font-semibold">Company Information</h3>
                            <Button size="sm" className="gap-1" onClick={() => { 
                                const co = masterData.find(r => r.company_name);
                                if (co) { setEditingRow(co); setForm(co as any); }
                                else { setForm({}); setEditingRow(null); }
                                setOpenDialog('company'); 
                            }}>
                                <Plus size={14} /> Update Info
                            </Button>
                        </div>
                        {loading ? (
                            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                        ) : (() => {
                            const co = masterData.find(r => r.company_name) || {};
                            return (
                                <div className="grid md:grid-cols-2 gap-4">
                                    {[
                                        ['Company Name', (co as any).company_name],
                                        ['GSTIN', (co as any).company_gstin],
                                        ['PAN', (co as any).company_pan],
                                        ['Phone', (co as any).company_phone],
                                        ['Email', (co as any).company_email],
                                        ['Address', (co as any).company_address],
                                        ['Billing Address', (co as any).billing_address],
                                        ['Destination Address', (co as any).destination_address],
                                    ].map(([label, value]) => (
                                        <div key={label} className="p-3 bg-muted/30 rounded-lg">
                                            <p className="text-xs text-muted-foreground">{label}</p>
                                            <p className="font-medium mt-1">{value || '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                </TabsContent>
            </Tabs>

            {/* ── DIALOGS ── */}

            {/* Vendor Dialog */}
            <Dialog open={openDialog === 'vendor'} onOpenChange={o => !o && setOpenDialog(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>{editingRow ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        {[
                            ['vendor_name', 'Vendor Name', false],
                            ['vendor_gstin', 'GSTIN', false],
                            ['vendor_email', 'Email', false],
                            ['vendor_address', 'Address', false],
                            ['payment_term', 'Payment Term', true]
                        ].map(([key, label, isDatalist]) => (
                            <div key={key as string}>
                                <label className="text-xs font-medium">{label as string}</label>
                                <Input
                                    className="mt-1"
                                    list={isDatalist ? `${key}-list` : undefined}
                                    value={form[key as string] || ''}
                                    onChange={e => setForm(p => ({ ...p, [key as string]: e.target.value }))}
                                />
                                {isDatalist && (
                                    <datalist id={`${key}-list`}>
                                        {unique(key as any).map(v => <option key={v} value={v} />)}
                                    </datalist>
                                )}
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button disabled={saving} onClick={() => saveRow({
                            vendor_name: form.vendor_name,
                            vendor_gstin: form.vendor_gstin,
                            vendor_email: form.vendor_email,
                            vendor_address: form.vendor_address,
                            payment_term: form.payment_term
                        })}>
                            {saving ? 'Saving...' : editingRow ? 'Update Vendor' : 'Save Vendor'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Department Dialog */}
            <Dialog open={openDialog === 'department'} onOpenChange={o => !o && setOpenDialog(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>{editingRow ? 'Edit Department' : 'Add Department'}</DialogTitle></DialogHeader>
                    <div>
                        <label className="text-xs font-medium">Department Name</label>
                        <Input className="mt-1" value={form.department || ''} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button disabled={saving} onClick={() => saveRow({ department: form.department })}>
                            {saving ? 'Saving...' : editingRow ? 'Update' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Item Dialog */}
            <Dialog open={openDialog === 'item'} onOpenChange={o => !o && setOpenDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{editingRow ? 'Edit Item' : 'Add Item'}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        {[
                            ['group_head', 'Group Head / Category'],
                            ['item_name', 'Item Name'],
                            ['unit_of_measurement', 'Unit of Measurement']
                        ].map(([key, label]) => (
                            <div key={key}>
                                <label className="text-xs font-medium">{label}</label>
                                <Input
                                    className="mt-1"
                                    list={key !== 'item_name' ? `${key}-list` : undefined}
                                    value={form[key] || ''}
                                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                                />
                                {key !== 'item_name' && (
                                    <datalist id={`${key}-list`}>
                                        {unique(key as any).map(v => <option key={v} value={v} />)}
                                    </datalist>
                                )}
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button disabled={saving} onClick={() => saveRow({
                            group_head: form.group_head,
                            item_name: form.item_name,
                            unit_of_measurement: form.unit_of_measurement
                        })}>
                            {saving ? 'Saving...' : editingRow ? 'Update Item' : 'Save Item'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Ward Dialog */}
            <Dialog open={openDialog === 'ward'} onOpenChange={o => !o && setOpenDialog(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>{editingRow ? 'Edit Ward / Floor' : 'Add Ward / Floor'}</DialogTitle></DialogHeader>
                    <div>
                        <label className="text-xs font-medium">Ward Name</label>
                        <Input className="mt-1" value={form.ward_name || ''} onChange={e => setForm(p => ({ ...p, ward_name: e.target.value }))} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button disabled={saving} onClick={() => saveRow({ ward_name: form.ward_name })}>
                            {saving ? 'Saving...' : editingRow ? 'Update' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Company Dialog */}
            <Dialog open={openDialog === 'company'} onOpenChange={o => !o && setOpenDialog(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>Update Company Info</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-3">
                        {[['company_name','Company Name'],['company_gstin','GSTIN'],['company_pan','PAN'],['company_phone','Phone'],['company_email','Email'],['company_address','Address'],['billing_address','Billing Address'],['destination_address','Destination Address']].map(([key, label]) => (
                            <div key={key} className={key.includes('address') ? 'col-span-2' : ''}>
                                <label className="text-xs font-medium">{label}</label>
                                <Input className="mt-1" value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button disabled={saving} onClick={() => saveRow(form)}>
                            {saving ? 'Saving...' : editingRow ? 'Update Company Info' : 'Save Company Info'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
