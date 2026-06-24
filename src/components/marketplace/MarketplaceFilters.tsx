import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MarketplaceFiltersProps {
  query: string;
  onQueryChange: (v: string) => void;
  cropFilter: string;
  onCropFilterChange: (v: string) => void;
  sortBy: string;
  onSortChange: (v: string) => void;
  cropTypes: string[];
  resultCount: number;
}

export function MarketplaceFilters({
  query,
  onQueryChange,
  cropFilter,
  onCropFilterChange,
  sortBy,
  onSortChange,
  cropTypes,
  resultCount,
}: MarketplaceFiltersProps) {
  const hasFilters = query || cropFilter !== 'all';

  return (
    <div className="glass-card rounded-xl p-4 space-y-4 sticky top-20 z-10">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search crops..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-9 bg-muted/30 border-border/50"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Crop type</Label>
        <Select value={cropFilter} onValueChange={onCropFilterChange}>
          <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All crops</SelectItem>
            {cropTypes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Sort by</Label>
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
            <SelectItem value="qty">Quantity</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{resultCount} products</span>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => { onQueryChange(''); onCropFilterChange('all'); }}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>
      {cropFilter !== 'all' && <Badge variant="outline">{cropFilter}</Badge>}
    </div>
  );
}
