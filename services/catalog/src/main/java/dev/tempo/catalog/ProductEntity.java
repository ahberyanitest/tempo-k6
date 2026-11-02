package dev.tempo.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "products")
public class ProductEntity {
    @Id
    @Column(nullable = false, length = 64, updatable = false)
    private String sku;

    @Column(nullable = false, length = 160)
    private String name;

    protected ProductEntity() {
    }

    public ProductEntity(String sku, String name) {
        this.sku = sku;
        this.name = name;
    }

    public String getSku() {
        return sku;
    }

    public String getName() {
        return name;
    }
}