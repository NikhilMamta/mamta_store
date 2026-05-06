import { z } from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ClipLoader as Loader } from 'react-spinners';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Eye, EyeClosed, Lock, User } from 'lucide-react';
import Logo from '../element/Logo';
import { toast } from 'sonner';

export default () => {
    const { login, loggedIn } = useAuth();
    const [visible, setVisible] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (loggedIn) {
            navigate('/');
        }
    }, [loggedIn]);

    const schema = z.object({
        username: z.string().nonempty('Username is required'),
        password: z.string().nonempty('Password is required'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            username: '',
            password: '',
        }
    });

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            const res = await login(values.username, values.password);
            if (!res) {
                toast.error("Invalid Username or Password");
            }
        } catch {
            toast.error("Something went wrong! Try again");
        }
    }

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-50 overflow-hidden font-sans">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="z-10 w-full max-w-lg px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <Card className="border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] rounded-[2rem] overflow-hidden bg-white/80 backdrop-blur-sm border border-white/20">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10 p-8 md:p-12">
                            <CardHeader className="text-center p-0 flex flex-col items-center space-y-6">
                                <div className="p-1">
                                    <Logo size={48} className="w-20 h-20" />
                                </div>
                                <div className="space-y-2">
                                    <CardTitle className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 uppercase">
                                        Store <span className="text-primary">App</span>
                                    </CardTitle>
                                    
                                </div>
                            </CardHeader>

                            <CardContent className="p-0 space-y-6">
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-500 ml-1">
                                                Username
                                            </FormLabel>
                                            <FormControl>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                        <User size={18} />
                                                    </div>
                                                    <Input
                                                        {...field}
                                                        placeholder="ENTER USERNAME"
                                                        className="h-14 pl-12 rounded-2xl border-none bg-slate-100/50 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium placeholder:tracking-wider text-sm"
                                                    />
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-500 ml-1">
                                                Password
                                            </FormLabel>
                                            <FormControl>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                        <Lock size={18} />
                                                    </div>
                                                    <Input
                                                        type={visible ? 'text' : 'password'}
                                                        placeholder="ENTER PASSWORD"
                                                        {...field}
                                                        className="h-14 pl-12 pr-12 rounded-2xl border-none bg-slate-100/50 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium placeholder:tracking-wider text-sm"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-transparent active:bg-transparent text-slate-400 hover:text-slate-600"
                                                        tabIndex={-1}
                                                        type="button"
                                                        onClick={() => setVisible(!visible)}
                                                    >
                                                        {visible ? <EyeClosed size={18} /> : <Eye size={18} />}
                                                        <span className="sr-only">Toggle password visibility</span>
                                                    </Button>
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>

                            <CardFooter className="p-0 pt-2">
                                <Button
                                    type="submit"
                                    className="h-14 w-full rounded-2xl bg-primary hover:bg-primary/90 text-white font-black tracking-[0.2em] uppercase shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none text-sm"
                                    disabled={form.formState.isSubmitting}
                                >
                                    {form.formState.isSubmitting ? (
                                        <Loader size={20} color="white" />
                                    ) : (
                                        "Sign In"
                                    )}
                                </Button>
                            </CardFooter>
                        </form>
                    </Form>
                </Card>
                <p className="mt-8 text-center text-[9px] font-bold tracking-[0.15em] uppercase text-slate-400">
                    &copy; {new Date().getFullYear()} Mamta Store Management Portal
                </p>
            </div>
        </div>
    );
};
