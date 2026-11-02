package dev.tempo.catalog;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final WebClient inventoryClient;
    private final ProductRepository productRepository;

    public ProductController(
            WebClient.Builder webClientBuilder,
            @Value("${inventory.url:http://localhost:8082}") String inventoryUrl,
            ProductRepository productRepository) {
        this.inventoryClient = webClientBuilder.baseUrl(inventoryUrl).build();
        this.productRepository = productRepository;
    }

    @GetMapping
    public Mono<List<Product>> getProducts() {
        return Flux.fromIterable(productRepository.findAll(Sort.by("sku")))
                .flatMap(this::withInventory)
                .collectList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Product> createProduct(@Valid @RequestBody CreateProductRequest request) {
        String sku = request.sku().trim();
        if (productRepository.existsById(sku)) {
            throw duplicateSku();
        }

        try {
            ProductEntity saved = productRepository.saveAndFlush(
                    new ProductEntity(sku, request.name().trim()));
            return withInventory(saved);
        } catch (DataIntegrityViolationException exception) {
            throw duplicateSku();
        }
    }

    @GetMapping("/{sku}")
    public Mono<Product> getProduct(@PathVariable String sku) {
        ProductEntity product = productRepository.findById(sku)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        return withInventory(product);
    }

    private Mono<Product> withInventory(ProductEntity product) {
        return inventoryClient.get()
                .uri("/api/inventory/{sku}", product.getSku())
                .retrieve()
                .bodyToMono(InventoryItem.class)
                .map(inventory -> new Product(product.getSku(), product.getName(), inventory.quantity()));
    }

    private ResponseStatusException duplicateSku() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "A product with this SKU already exists");
    }

    public record CreateProductRequest(
            @NotBlank @Size(max = 64) @Pattern(regexp = "[A-Za-z0-9._-]+") String sku,
            @NotBlank @Size(max = 160) String name) {
    }

    public record Product(String sku, String name, int available) {
    }

    public record InventoryItem(String sku, int quantity) {
    }
}
