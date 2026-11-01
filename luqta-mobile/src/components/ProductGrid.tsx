import React from "react";
import { View, useWindowDimensions } from "react-native";
import { Product } from "../data/products";
import { ProductCard } from "./ProductCard";
export function ProductGrid({ items }: { items: Product[] }) {
  const [width, setWidth] = React.useState(0);
  const { fontScale } = useWindowDimensions();
  const effectiveWidth = width / Math.max(1, fontScale / 1.25);
  const columns = effectiveWidth >= 870 ? 4 : effectiveWidth >= 620 ? 3 : effectiveWidth >= 310 ? 2 : 1;
  const itemWidth = (
    columns === 4
      ? "23.5%"
      : columns === 3
        ? "31.8%"
        : columns === 2
          ? "48%"
          : "100%"
  ) as `${number}%`;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: "row-reverse",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 18,
      }}
    >
      {items.map((product) => (
        <ProductCard key={product.id} product={product} width={itemWidth} />
      ))}
    </View>
  );
}
