import { cn } from '@/lib/utils';
import { Box } from 'lucide-react';

export default ({ className, size = 20 }: { className?: string; size?: number }) => (
    <div
        className={cn(
            'flex items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-emerald-400 shadow-lg ring-1 ring-white/20 transition-transform active:scale-95',
            className
        )}
    >
        <Box className="text-white" size={size} />
    </div>
);
