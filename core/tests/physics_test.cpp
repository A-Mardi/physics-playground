#include "physics.hpp"
#include <cmath>
#include <iostream>
#include <limits>
#include <stdexcept>

void require(bool condition, const char *message) {
    if (!condition)
        throw std::runtime_error(message);
}
float *body(int id) {
    float *data = world_data();
    for (int i = 0; i < world_count(); ++i)
        if (int(data[i * 12]) == id)
            return data + i * 12;
    throw std::runtime_error("missing body");
}
int main() {
    world_reset();
    int disk = body_add(0, 700, 100, 40, 40, 0, 0);
    for (int i = 0; i < 1500; ++i)
        world_step(1.0F / 120);
    require(std::abs(body(disk)[3] - 820) < 2, "disk must rest on floor");
    require(std::abs(body(disk)[8]) < 5, "resting velocity must stay small");
    world_reset();
    world_gravity(0, 0);
    world_material(1, 0);
    int a = body_add(0, 600, 400, 40, 40, 0, 0), b = body_add(0, 700, 400, 40, 40, 0, 0);
    body_velocity(a, 100, 0, 0);
    body_velocity(b, -100, 0, 0);
    for (int i = 0; i < 60; ++i)
        world_step(1.0F / 120);
    require(body(a)[7] < 0 && body(b)[7] > 0, "elastic disks must reverse direction");
    require(body_add(0, 1e30F, 0, 20, 20, 0, 0) == -1, "reject unsafe positions");
    require(body_add(0, 0, 0, std::numeric_limits<float>::quiet_NaN(), 20, 0, 0) == -1,
            "reject NaN");
    body_remove(0);
    require(world_count() == 6, "boundary cannot be removed");
    body_remove(a);
    require(world_count() == 5, "user bodies can be removed");
    std::cout << "Physics invariants passed\n";
}
