import Heading from '../element/Heading';
import {
    ClipboardList,
    LayoutDashboard,
    PackageCheck,
    Truck,
    Warehouse,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, type ChartConfig } from '../ui/chart';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { useEffect, useState } from 'react';
import { useSheets } from '@/context/SheetsContext';
import { analyzeData } from '@/lib/filter';



function CustomChartTooltipContent({
    payload,
    label,
}: {
    payload?: { payload: { quantity: number; frequency: number } }[];
    label?: string;
}) {
    if (!payload?.length) return null;

    const data = payload[0].payload;

    return (
        <div className="rounded-md border bg-white px-3 py-2 shadow-sm text-sm">
            <p className="font-medium">{label}</p>
            <p>Quantity: {data.quantity}</p>
            <p>Frequency: {data.frequency}</p>
        </div>
    );
}
export default function UsersTable() {
    const { receivedSheet, indentSheet, inventorySheet, storeOutSheet, inventoryLoading } = useSheets();
    const [chartData, setChartData] = useState<
        {
            name: string;
            quantity: number;
            frequency: number;
        }[]
    >([]);
    const [topVendorsData, setTopVendors] = useState<
        {
            name: string;
            orders: number;
            quantity: number;
        }[]
    >([]);
 
    // Items
    const [indent, setIndent] = useState({ count: 0, quantity: 0 });
    const [purchase, setPurchase] = useState({ count: 0, quantity: 0 });
    const [out, setOut] = useState({ count: 0, quantity: 0 });
    const [alerts, setAlerts] = useState({ lowStock: 0, outOfStock: 0 });
 
    useEffect(() => {
        const {
            topVendors,
            topProducts,
            issuedIndentCount,
            approvedIndentCount,
            totalIssuedQuantity,
            receivedPurchaseCount,
            totalApprovedQuantity,
            totalPurchasedQuantity,
        } = analyzeData(
            { receivedSheet, indentSheet, storeOutSheet },
            {
                startDate: undefined,
                endDate: undefined,
                vendors: [],
                products: [],
            }
        );
 
        setChartData(
            topProducts.map((p) => ({ frequency: p.freq, quantity: p.quantity, name: p.name }))
        );
        setTopVendors(topVendors);
        setIndent({ quantity: totalApprovedQuantity, count: approvedIndentCount });
        setPurchase({ quantity: totalPurchasedQuantity, count: receivedPurchaseCount });
        setOut({ quantity: totalIssuedQuantity, count: issuedIndentCount });

        // Calculate Stock Alerts
        let low = 0;
        let outStock = 0;
        inventorySheet.forEach(item => {
            const stock = Number(item.currentStock || item.opening || 0);
            const status = item.colorCode?.toLowerCase() || '';
            if (stock === 0) {
                outStock++;
            } else if (status === 'red') {
                low++;
            }
        });
        setAlerts({ lowStock: low, outOfStock: outStock });

    }, [indentSheet, receivedSheet, storeOutSheet, inventorySheet]);



    const chartConfig = {
        quantity: {
            label: 'Quantity',
            color: 'var(--color-primary)',
        },
    } satisfies ChartConfig;
    return (
        <div>
            <Heading heading="Dashboard" subtext="View you analytics">
                <LayoutDashboard size={50} className="text-primary" />
            </Heading>

            <div className="grid gap-3 m-3">
                <div className="grid md:grid-cols-4 gap-3">
                    <Card className="bg-gradient-to-br from-transparent to-primary/10">
                        <CardContent>
                            <div className="text-primary flex justify-between">
                                <p className="font-semibold">Total Indents</p>
                                <ClipboardList size={18} />
                            </div>
                            <p className="text-3xl font-bold text-primary/80">{indent.count}</p>
                            <div className="text-primary flex justify-between">
                                <p className="text-sm ">Indented Quantity</p>
                                <p>{indent.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-transparent to-green-500/10">
                        <CardContent>
                            <div className="text-green-500 flex justify-between">
                                <p className="font-semibold">Total Purchases</p>
                                <Truck size={18} />
                            </div>
                            <p className="text-3xl font-bold text-green-800">{purchase.count}</p>
                            <div className="text-green-500 flex justify-between">
                                <p className="text-sm ">Purchased Quantity</p>
                                <p>{purchase.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-transparent to-orange-500/10">
                        <CardContent>
                            <div className="text-orange-500 flex justify-between">
                                <p className="font-semibold">Total Issued</p>
                                <PackageCheck size={18} />
                            </div>
                            <p className="text-3xl font-bold text-orange-800">{out.count}</p>

                            <div className="text-orange-500 flex justify-between">
                                <p className="text-sm ">Out Quantity</p>
                                <p>{out.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-transparent to-yellow-500/10 text-yellow-500 ">
                        <CardContent>
                            <div className="flex justify-between">
                                <p className="font-semibold">Out of Stock</p>
                                <Warehouse size={18} />
                            </div>
                            <p className="text-3xl font-bold text-yellow-800">
                                {alerts.outOfStock}
                            </p>

                            <div className="text-yellow-500 flex justify-between">
                                <p className="text-sm ">Low in Stock</p>
                                <p>{alerts.lowStock}</p >
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <Card className="w-[55%] md:min-w-150 flex-grow">
                        <CardHeader>
                            <CardTitle className="text-xl">Top Purchased Products</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer className="max-h-80 w-full" config={chartConfig}>
                                <BarChart
                                    accessibilityLayer
                                    data={chartData}
                                    layout="vertical"
                                    margin={{
                                        right: 16,
                                    }}
                                >
                                    <defs>
                                        <linearGradient
                                            id="barGradient"
                                            x1="0"
                                            y1="0"
                                            x2="1"
                                            y2="0"
                                        >
                                            <stop offset="100%" stopColor="var(--primary)" />
                                            <stop offset="0%" stopColor="oklch(0.5 0.15 155)" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid horizontal={false} />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={10}
                                        axisLine={false}
                                        tickFormatter={(value: any) => value.slice(0, 3)}
                                        hide
                                    />
                                    <XAxis dataKey="frequency" type="number" hide />
                                    <ChartTooltip
                                        cursor={false}
                                        content={<CustomChartTooltipContent />}
                                    />
                                    <Bar
                                        dataKey="frequency"
                                        layout="vertical"
                                        fill="url(#barGradient)"
                                        radius={4}
                                    >
                                        <LabelList
                                            dataKey="name"
                                            position="insideLeft"
                                            offset={8}
                                            className="fill-(--color-background) font-semibold"
                                            fontSize={12}
                                        />
                                        <LabelList
                                            dataKey="frequency"
                                            position="insideRight"
                                            offset={8}
                                            className="fill-(--color-background) font-semibold"
                                            fontSize={12}
                                        />
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <Card className="flex-grow min-w-60 w-[40%]">
                        <CardHeader>
                            <CardTitle className="text-xl">Top Vendors</CardTitle>
                        </CardHeader>
                        <CardContent className="text-base grid gap-2">
                            {topVendorsData.map((vendor, i) => (
                                <div className="flex justify-between" key={i}>
                                    <p className="font-semibold text-md">{vendor.name}</p>
                                    <div className="flex gap-5">
                                        <p>{vendor.orders} Orders</p>
                                        <p>{vendor.quantity} Items</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
