import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Heading from '../element/Heading';
import { Database, Building2, Users, Layers, MapPin, Plus, Trash2, Building, RefreshCw, Pencil, Search } from 'lucide-react';
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
    mux?: string;            // Legacy: kept for backward compat
    issue_uom?: string;      // Issue / Store-Out UOM label (e.g., 'ml', 'pcs')
    issue_uom_factor?: string; // Numeric factor as string (e.g., '1000' for LTR→ml)
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
    const [masterData, setMasterData] = useState<MasterRow[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState<string | null>(null);
    const [form, setForm] = useState<Record<string, string>>({});
    const [editingRow, setEditingRow] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [itemSearch, setItemSearch] = useState('');

    async function fetchMaster() {
        setLoading(true);
        const [masterRes, vendorsRes, itemsRes] = await Promise.all([
            supabase.from('master').select('*'),
            supabase.from('vendors').select('*'),
            supabase.from('items').select('*')
        ]);

        if (masterRes.error) {
            toast.error('Failed to load master data');
        } else {
            setMasterData(masterRes.data || []);
        }

        if (vendorsRes.error) {
            console.error('Failed to load vendors:', vendorsRes.error);
        } else {
            setVendors(vendorsRes.data || []);
        }

        if (itemsRes.error) {
            console.error('Failed to load items:', itemsRes.error);
        } else {
            setItems(itemsRes.data || []);
        }

        setLoading(false);
    }

    useEffect(() => { fetchMaster(); }, []);

    async function saveRow(fields: Record<string, any>, entityType: 'vendor' | 'item' | 'department' | 'ward' | 'company') {
        setSaving(true);
        let res;
        const targetTable = entityType === 'vendor' ? 'vendors' : entityType === 'item' ? 'items' : 'master';

        if (editingRow) {
            if (entityType === 'vendor') {
                const id = editingRow.id;
                if (id !== undefined) {
                    res = await supabase.from('vendors').update(fields).eq('id', id);
                } else {
                    res = await supabase.from('vendors').update(fields).eq('vendor_name', editingRow.vendor_name);
                }
            } else if (entityType === 'item') {
                const id = editingRow.id;
                if (id !== undefined) {
                    res = await supabase.from('items').update(fields).eq('id', id);
                } else {
                    res = await supabase.from('items').update(fields).eq('item_name', editingRow.item_name);
                }
            } else {
                const idField = 
                    editingRow.department ? 'department' :
                    editingRow.ward_name ? 'ward_name' :
                    editingRow.company_name ? 'company_name' : null;

                if (idField) {
                    res = await supabase.from('master').update(fields).eq(idField, (editingRow as any)[idField]);
                } else {
                    res = await supabase.from('master').insert([fields]);
                }
            }
        } else {
            res = await supabase.from(targetTable).insert([fields]);
        }

        if (res.error) {
            toast.error('Failed to save: ' + res.error.message);
        } else {
            toast.success(editingRow ? '✅ Updated successfully' : '✅ Saved successfully');
            setOpenDialog(null);
            setForm({});
            setEditingRow(null);
            fetchMaster();
        }
        setSaving(false);
    }

    async function deleteRow(field: string, value: string, entityType?: 'vendor' | 'item') {
        if (!confirm(`Delete "${value}"?`)) return;
        
        let res;
        if (entityType === 'vendor') {
            res = await supabase.from('vendors').delete().eq('vendor_name', value);
        } else if (entityType === 'item') {
            res = await supabase.from('items').delete().eq('item_name', value);
        } else {
            res = await supabase.from('master').delete().eq(field, value);
        }

        if (res.error) {
            toast.error('Delete failed: ' + res.error.message);
        } else {
            toast.success('Deleted');
            fetchMaster();
        }
    }

    const unique = (field: keyof MasterRow | 'purchase_uom') => {
        if (field === 'vendor_name' || field === 'vendor_gstin' || field === 'vendor_address' || field === 'vendor_email' || field === 'payment_term') {
            return [...new Set(vendors.map(r => r[field]).filter(Boolean))] as string[];
        }
        if (field === 'item_name' || field === 'group_head' || field === 'unit_of_measurement' || field === 'purchase_uom' || field === 'issue_uom' || field === 'issue_uom_factor') {
            const mappedField = field === 'unit_of_measurement' ? 'purchase_uom' : field;
            return [...new Set(items.map(r => r[mappedField]).filter(Boolean))] as string[];
        }
        return [...new Set(masterData.map(r => r[field]).filter(Boolean))] as string[];
    };

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
                                        <TableHead className="w-12 text-center">S.No.</TableHead>
                                        <TableHead>Vendor Name</TableHead>
                                        <TableHead>GSTIN</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Address</TableHead>
                                        <TableHead className="w-24">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? <LoadingRows cols={6} /> :
                                        vendors.map((r, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-center font-medium">{i + 1}</TableCell>
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
                                                        onClick={() => deleteRow('vendor_name', r.vendor_name!, 'vendor')}>
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
                                        <TableHead className="w-12 text-center">S.No.</TableHead>
                                        <TableHead>Department Name</TableHead>
                                        <TableHead className="w-24">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? <LoadingRows cols={3} /> :
                                        unique('department').map((dep, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-center font-medium">{i + 1}</TableCell>
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
                                                        onClick={() => deleteRow('department', dep)}>
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
                        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h3 className="font-semibold text-sm">Items / Group Heads</h3>
                            <div className="flex items-center gap-3">
                                <div className="relative w-64">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search items or group heads..."
                                        value={itemSearch}
                                        onChange={(e) => setItemSearch(e.target.value)}
                                        className="pl-9 h-9 text-xs"
                                    />
                                </div>
                                <Button size="sm" className="gap-1" onClick={() => { setForm({}); setEditingRow(null); setOpenDialog('item'); }}>
                                    <Plus size={14} /> Add Item
                                </Button>
                            </div>
                        </div>
                        <ScrollArea className="h-[60vh]">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-primary text-primary-foreground">
                                    <TableRow>
                                        <TableHead className="w-12 text-center">S.No.</TableHead>
                                        <TableHead>Group Head</TableHead>
                                        <TableHead>Item Name</TableHead>
                                        <TableHead>Purchase UOM</TableHead>
                                        <TableHead>Issue UOM</TableHead>
                                        <TableHead>Issue Factor</TableHead>
                                        <TableHead className="w-24">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? <LoadingRows cols={6} /> : (() => {
                                        const filtered = items
                                            .filter(r => r.item_name)
                                            .filter(r => {
                                                if (!itemSearch) return true;
                                                const searchLower = itemSearch.toLowerCase();
                                                return (
                                                    r.item_name?.toLowerCase().includes(searchLower) ||
                                                    r.group_head?.toLowerCase().includes(searchLower)
                                                );
                                            });

                                        if (filtered.length === 0) {
                                            return (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                                        No items found matching "{itemSearch}"
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }

                                        return filtered.map((r, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-center font-medium">{i + 1}</TableCell>
                                                <TableCell>{r.group_head}</TableCell>
                                                <TableCell className="font-medium">{r.item_name}</TableCell>
                                                <TableCell>{r.purchase_uom || r.unit_of_measurement}</TableCell>
                                                <TableCell>
                                                    {r.issue_uom || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {r.issue_uom_factor
                                                        ? <span className="text-xs font-mono bg-primary/10 px-1.5 py-0.5 rounded">{r.issue_uom_factor}</span>
                                                        : <span className="text-muted-foreground">—</span>
                                                    }
                                                </TableCell>
                                                <TableCell className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="text-primary h-7 w-7 p-0"
                                                        onClick={() => { setEditingRow(r); setForm({ ...r, unit_of_measurement: r.purchase_uom || r.unit_of_measurement } as any); setOpenDialog('item'); }}>
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0"
                                                        onClick={() => deleteRow('item_name', r.item_name!, 'item')}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ));
                                    })()}
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
                                        <TableHead className="w-12 text-center">S.No.</TableHead>
                                        <TableHead>Ward / Floor Name</TableHead>
                                        <TableHead className="w-24">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? <LoadingRows cols={3} /> :
                                        unique('ward_name').map((ward, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-center font-medium">{i + 1}</TableCell>
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
                                                        onClick={() => deleteRow('ward_name', ward)}>
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
                        }, 'vendor')}>
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
                        <Button disabled={saving} onClick={() => saveRow({ department: form.department }, 'department')}>
                            {saving ? 'Saving...' : editingRow ? 'Update' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={openDialog === 'item'} onOpenChange={o => !o && setOpenDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{editingRow ? 'Edit Item' : 'Add Item'}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        {[
                            ['group_head', 'Group Head / Category'],
                            ['item_name', 'Item Name'],
                            ['unit_of_measurement', 'Purchase UOM (e.g., LTR, KG, Box)']
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
                        {/* Issue UOM section */}
                        <div className="border-t pt-3 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Store-Out Unit (Issue UOM)</p>
                            <div>
                                <label className="text-xs font-medium">Issue UOM <span className="text-muted-foreground">(e.g., ml, g, pcs, tablet)</span></label>
                                <Input
                                    className="mt-1"
                                    value={form.issue_uom || ''}
                                    onChange={e => setForm(p => ({ ...p, issue_uom: e.target.value }))}
                                    placeholder="e.g., ml"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium">
                                    Issue Factor <span className="text-muted-foreground">(1 Purchase UOM = ? Issue units)</span>
                                </label>
                                <Input
                                    className="mt-1"
                                    type="number"
                                    min="1"
                                    value={form.issue_uom_factor || ''}
                                    onChange={e => setForm(p => ({ ...p, issue_uom_factor: e.target.value }))}
                                    placeholder="e.g., 1000 for LTR→ml"
                                />
                            </div>
                            {/* Live preview */}
                            {(form.unit_of_measurement || form.purchase_uom) && form.issue_uom && form.issue_uom_factor && (
                                <div className="bg-primary/5 border border-primary/10 rounded-md px-3 py-2 text-xs text-muted-foreground">
                                    Preview: <span className="font-semibold text-foreground">
                                        1 {form.unit_of_measurement || form.purchase_uom} = {form.issue_uom_factor} {form.issue_uom}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button disabled={saving} onClick={() => saveRow({
                            group_head: form.group_head,
                            item_name: form.item_name,
                            purchase_uom: form.unit_of_measurement || form.purchase_uom,
                            issue_uom: form.issue_uom,
                            issue_uom_factor: form.issue_uom_factor ? Number(form.issue_uom_factor) : null
                        }, 'item')}>
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
                        <Button disabled={saving} onClick={() => saveRow({ ward_name: form.ward_name }, 'ward')}>
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
                        <Button disabled={saving} onClick={() => saveRow(form, 'company')}>
                            {saving ? 'Saving...' : editingRow ? 'Update Company Info' : 'Save Company Info'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
