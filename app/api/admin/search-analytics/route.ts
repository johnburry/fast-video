import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const tenantId = searchParams.get('tenant_id');
    const channelId = searchParams.get('channel_id');

    // Build query
    let query = supabaseAdmin
      .from('search_analytics')
      .select('*', { count: 'exact' })
      .order('searched_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    if (channelId) {
      query = query.eq('channel_id', channelId);
    }

    const { data: analytics, error, count } = await query;

    if (error) {
      console.error('Error fetching search analytics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch search analytics' },
        { status: 500 }
      );
    }

    // Get summary statistics
    const { data: stats } = await supabaseAdmin
      .from('search_analytics')
      .select('search_query, tenant_name, channel_name, results_count');

    const summary = {
      totalSearches: count || 0,
      uniqueQueries: new Set(stats?.map(s => s.search_query.toLowerCase())).size,
      averageResults: stats && stats.length > 0
        ? Math.round(stats.reduce((sum, s) => sum + (s.results_count || 0), 0) / stats.length)
        : 0,
      topQueries: getTopQueries(stats || []),
      topTenants: getTopTenants(stats || []),
      topChannels: getTopChannels(stats || []),
    };

    return NextResponse.json({
      analytics,
      total: count || 0,
      limit,
      offset,
      summary,
    });
  } catch (error) {
    console.error('Error in search analytics endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getTopQueries(stats: any[]): Array<{ query: string; count: number }> {
  const queryCount = new Map<string, number>();
  stats.forEach(s => {
    const query = s.search_query.toLowerCase();
    queryCount.set(query, (queryCount.get(query) || 0) + 1);
  });

  return Array.from(queryCount.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function getTopTenants(stats: any[]): Array<{ tenant: string; count: number }> {
  const tenantCount = new Map<string, number>();
  stats.forEach(s => {
    if (s.tenant_name) {
      tenantCount.set(s.tenant_name, (tenantCount.get(s.tenant_name) || 0) + 1);
    }
  });

  return Array.from(tenantCount.entries())
    .map(([tenant, count]) => ({ tenant, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function getTopChannels(stats: any[]): Array<{ channel: string; count: number }> {
  const channelCount = new Map<string, number>();
  stats.forEach(s => {
    if (s.channel_name) {
      channelCount.set(s.channel_name, (channelCount.get(s.channel_name) || 0) + 1);
    }
  });

  return Array.from(channelCount.entries())
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
