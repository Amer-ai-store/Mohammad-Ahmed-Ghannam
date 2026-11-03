// Vendor page — products of one store.
import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Shell } from "../../components/Shell";
import { ProductGrid } from "../../components/ProductGrid";
import { ErrorBlock, LoadingBlock } from "../../components/design/kit";
import { useStore } from "../../lib/store";
import { useRemote } from "../../lib/useRemote";
import type { Product } from "../../data/products";

export default function VendorPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, settings } = useStore();
  const { data, loading, error, reload } = useRemote<{ vendor: { name: string }; products: Product[] }>(id ? `/vendors/${id}` : null, { demo: () => ({ vendor: { name: settings.storeName || "لُقطة" }, products: id === "luqta" ? products : [] }) });
  const items = (data?.products || []).map((p) => products.find((x) => x.id === p.id) || p);
  return (
    <Shell title={data?.vendor.name || "المتجر"} subtitle={`${items.length} منتج`}>
      {loading && !data ? <LoadingBlock /> : !data ? <ErrorBlock message={error || "المتجر غير موجود"} onRetry={reload} /> : <ProductGrid items={items} />}
    </Shell>
  );
}
