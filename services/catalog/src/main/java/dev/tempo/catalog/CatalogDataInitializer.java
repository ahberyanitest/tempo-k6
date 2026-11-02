package dev.tempo.catalog;

import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class CatalogDataInitializer implements CommandLineRunner {
    private final ProductRepository productRepository;

    public CatalogDataInitializer(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @Override
    public void run(String... args) {
        if (productRepository.count() == 0) {
            productRepository.saveAll(List.of(
                    new ProductEntity("sku-101", "Field Notes"),
                    new ProductEntity("sku-202", "Desk Lamp"),
                    new ProductEntity("sku-303", "Canvas Tote")));
        }
    }
}