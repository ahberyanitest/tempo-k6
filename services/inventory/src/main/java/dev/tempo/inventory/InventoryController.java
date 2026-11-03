package dev.tempo.inventory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {
    private static final Logger logger = LoggerFactory.getLogger(InventoryController.class);

    @GetMapping("/{sku}")
    public InventoryItem getInventory(@PathVariable String sku) {
        logger.info("Getting inventory");
        return new InventoryItem(sku, 24);
    }

    public record InventoryItem(String sku, int quantity) {
    }
}
