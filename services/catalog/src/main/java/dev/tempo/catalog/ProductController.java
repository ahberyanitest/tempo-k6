package dev.tempo.catalog;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final WebClient inventoryClient;

    public ProductController(
            WebClient.Builder webClientBuilder,
            @Value("${inventory.url:http://localhost:8082}") String inventoryUrl) {
        this.inventoryClient = webClientBuilder.baseUrl(inventoryUrl).build();
    }

    @GetMapping
    public Mono<List<Product>> getProducts() {
        return Flux.fromIterable(List.of(
                        new Product("sku-101", "Field Notes", 0),
                        new Product("sku-202", "Desk Lamp", 0),
                        new Product("sku-303", "Canvas Tote", 0)))
                .flatMap(product -> inventoryClient.get()
                        .uri("/api/inventory/{sku}", product.sku())
                        .retrieve()
                        .bodyToMono(InventoryItem.class)
                        .map(inventory -> new Product(product.sku(), product.name(), inventory.quantity())))
                .collectList();
    }

    @GetMapping("/{sku}")
    public Mono<Product> getProduct(@PathVariable String sku) {
        Product product = new Product(sku, "Sample product " + sku, 0);
        return inventoryClient.get()
                .uri("/api/inventory/{sku}", sku)
                .retrieve()
                .bodyToMono(InventoryItem.class)
                .map(inventory -> new Product(product.sku(), product.name(), inventory.quantity()));
    }

    public record Product(String sku, String name, int available) {
    }

    public record InventoryItem(String sku, int quantity) {
    }
}
