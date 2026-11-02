package dev.tempo.inventory;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {
    @GetMapping("/{sku}")
    public InventoryItem getInventory(@PathVariable String sku) {
        return new InventoryItem(sku, 24);
    }

    public record InventoryItem(String sku, int quantity) {
    }
}
