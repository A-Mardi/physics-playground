#include "physics.hpp"
#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

namespace {
constexpr int capacity = 512, columns = 28, rows = 18;
constexpr float cell = 50;
struct Vec {
    float x = 0, y = 0;
    Vec operator+(Vec b) const { return {x + b.x, y + b.y}; }
    Vec operator-(Vec b) const { return {x - b.x, y - b.y}; }
    Vec operator*(float s) const { return {x * s, y * s}; }
};
float dot(Vec a, Vec b) { return a.x * b.x + a.y * b.y; }
float cross(Vec a, Vec b) { return a.x * b.y - a.y * b.x; }
Vec spin(float w, Vec r) { return {-w * r.y, w * r.x}; }
float length(Vec v) { return std::sqrt(dot(v, v)); }
Vec rotate(Vec p, float a) {
    return {p.x * std::cos(a) - p.y * std::sin(a), p.x * std::sin(a) + p.y * std::cos(a)};
}
struct Body {
    int id = 0, shape = 0;
    Vec p, v;
    float w = 0, h = 0, angle = 0, angular = 0, im = 0, ii = 0;
};
struct Contact {
    int a = 0, b = 0;
    Vec normal;
    float depth = 0;
    std::array<Vec, 2> points{};
    int count = 0;
};
std::vector<Body> bodies;
std::vector<Contact> contacts;
std::array<std::vector<int>, columns * rows> grid;
std::array<unsigned char, capacity * capacity> seen{};
std::array<float, capacity * 12> output{};
Vec gravity{0, 760};
float restitution = .2F, friction = .45F;
int nextId = 0, candidateCount = 0;
std::array<Vec, 4> vertices(const Body &b) {
    return {b.p + rotate({-b.w / 2, -b.h / 2}, b.angle), b.p + rotate({b.w / 2, -b.h / 2}, b.angle),
            b.p + rotate({b.w / 2, b.h / 2}, b.angle), b.p + rotate({-b.w / 2, b.h / 2}, b.angle)};
}
bool inside(Vec p, const Body &b) {
    Vec q = rotate(p - b.p, -b.angle);
    return std::abs(q.x) <= b.w / 2 + .15F && std::abs(q.y) <= b.h / 2 + .15F;
}
float extent(const Body &b, Vec axis) {
    return std::abs(dot(rotate({1, 0}, b.angle), axis)) * b.w / 2 +
           std::abs(dot(rotate({0, 1}, b.angle), axis)) * b.h / 2;
}
bool collide(const Body &a, const Body &b, Contact &c) {
    if (a.shape == 0 && b.shape == 0) {
        Vec d = b.p - a.p;
        float distance = length(d), radius = (a.w + b.w) / 2;
        if (distance >= radius)
            return false;
        c.normal = distance > .0001F ? d * (1 / distance) : Vec{1, 0};
        c.depth = radius - distance;
        c.points[0] = a.p + c.normal * (a.w / 2 - c.depth / 2);
        c.count = 1;
        return true;
    }
    if (a.shape == 0 || b.shape == 0) {
        bool first = a.shape == 0;
        const Body &disk = first ? a : b;
        const Body &box = first ? b : a;
        Vec local = rotate(disk.p - box.p, -box.angle);
        Vec closest{std::clamp(local.x, -box.w / 2, box.w / 2),
                    std::clamp(local.y, -box.h / 2, box.h / 2)};
        Vec delta = closest - local;
        float distance = length(delta), radius = disk.w / 2;
        Vec normal;
        if (distance > .0001F) {
            if (distance >= radius)
                return false;
            normal = rotate(delta * (1 / distance), box.angle);
            c.depth = radius - distance;
        } else {
            float dx = box.w / 2 - std::abs(local.x), dy = box.h / 2 - std::abs(local.y);
            Vec out;
            if (dx < dy) {
                out = {local.x >= 0 ? 1.0F : -1.0F, 0};
                closest.x = out.x * box.w / 2;
            } else {
                out = {0, local.y >= 0 ? 1.0F : -1.0F};
                closest.y = out.y * box.h / 2;
            }
            normal = rotate(out * -1, box.angle);
            c.depth = radius + std::min(dx, dy);
        }
        c.normal = first ? normal : normal * -1;
        c.points[0] = box.p + rotate(closest, box.angle);
        c.count = 1;
        return true;
    }
    std::array<Vec, 4> axes{rotate({1, 0}, a.angle), rotate({0, 1}, a.angle),
                            rotate({1, 0}, b.angle), rotate({0, 1}, b.angle)};
    c.depth = 1e9F;
    for (Vec axis : axes) {
        float overlap = extent(a, axis) + extent(b, axis) - std::abs(dot(b.p - a.p, axis));
        if (overlap <= 0)
            return false;
        if (overlap < c.depth) {
            c.depth = overlap;
            c.normal = dot(b.p - a.p, axis) < 0 ? axis * -1 : axis;
        }
    }
    std::array<Vec, 8> points{};
    int count = 0;
    for (Vec p : vertices(a))
        if (inside(p, b))
            points[static_cast<size_t>(count++)] = p;
    for (Vec p : vertices(b))
        if (inside(p, a))
            points[static_cast<size_t>(count++)] = p;
    if (count == 0) {
        c.points[0] = (a.p + b.p) * .5F;
        c.count = 1;
        return true;
    }
    Vec tangent{-c.normal.y, c.normal.x};
    auto [lo, hi] =
        std::minmax_element(points.begin(), points.begin() + count,
                            [tangent](Vec u, Vec v) { return dot(u, tangent) < dot(v, tangent); });
    c.points[0] = *lo;
    c.points[1] = *hi;
    c.count = length(*hi - *lo) < .5F ? 1 : 2;
    return true;
}
void apply(Body &a, Body &b, Vec impulse, Vec ra, Vec rb) {
    a.v = a.v - impulse * a.im;
    b.v = b.v + impulse * b.im;
    a.angular -= cross(ra, impulse) * a.ii;
    b.angular += cross(rb, impulse) * b.ii;
}
void solve(Contact &c) {
    Body &a = bodies[static_cast<size_t>(c.a)];
    Body &b = bodies[static_cast<size_t>(c.b)];
    for (int k = 0; k < c.count; ++k) {
        Vec ra = c.points[static_cast<size_t>(k)] - a.p,
            rb = c.points[static_cast<size_t>(k)] - b.p;
        Vec relative = b.v + spin(b.angular, rb) - a.v - spin(a.angular, ra);
        float speed = dot(relative, c.normal);
        if (speed >= 0)
            continue;
        float ca = cross(ra, c.normal), cb = cross(rb, c.normal);
        float divisor = a.im + b.im + ca * ca * a.ii + cb * cb * b.ii;
        float bounce = speed < -30 ? restitution : 0;
        float impulse = -(1 + bounce) * speed / divisor / static_cast<float>(c.count);
        apply(a, b, c.normal * impulse, ra, rb);
        relative = b.v + spin(b.angular, rb) - a.v - spin(a.angular, ra);
        Vec tangent = relative - c.normal * dot(relative, c.normal);
        float magnitude = length(tangent);
        if (magnitude < .0001F)
            continue;
        tangent = tangent * (1 / magnitude);
        ca = cross(ra, tangent);
        cb = cross(rb, tangent);
        divisor = a.im + b.im + ca * ca * a.ii + cb * cb * b.ii;
        float drag = std::clamp(-dot(relative, tangent) / divisor / static_cast<float>(c.count),
                                -friction * impulse, friction * impulse);
        apply(a, b, tangent * drag, ra, rb);
    }
}
Body *find(int id) {
    for (auto &b : bodies)
        if (b.id == id)
            return &b;
    return nullptr;
}
} // namespace

extern "C" {
int body_add(int shape, float x, float y, float width, float height, float angle, int fixed) {
    if (bodies.size() >= capacity || (shape != 0 && shape != 1) || !std::isfinite(x) ||
        !std::isfinite(y) || std::abs(x) > 5000 || std::abs(y) > 5000 || !std::isfinite(width) ||
        !std::isfinite(height) || !std::isfinite(angle) || width < 2 || height < 2 ||
        width > 3000 || height > 3000)
        return -1;
    Body b{};
    b.id = nextId++;
    b.shape = shape;
    b.p = {x, y};
    b.w = width;
    b.h = shape == 0 ? width : height;
    b.angle = angle;
    float mass = b.w * b.h / 1600;
    b.im = fixed ? 0 : 1 / mass;
    b.ii =
        fixed ? 0 : 1 / (shape == 0 ? mass * b.w * b.w / 8 : mass * (b.w * b.w + b.h * b.h) / 12);
    bodies.push_back(b);
    return b.id;
}
void world_reset() {
    bodies.clear();
    contacts.clear();
    nextId = 0;
    candidateCount = 0;
    gravity = {0, 760};
    restitution = .2F;
    friction = .45F;
    body_add(1, 700, 860, 1440, 40, 0, 1);
    body_add(1, -20, 420, 40, 920, 0, 1);
    body_add(1, 1420, 420, 40, 920, 0, 1);
    body_add(1, 700, -20, 1440, 40, 0, 1);
}
void body_remove(int id) {
    if (id >= 4)
        bodies.erase(std::remove_if(bodies.begin(), bodies.end(),
                                    [id](const Body &b) { return b.id == id; }),
                     bodies.end());
}
void body_move(int id, float x, float y, float angle) {
    if (id >= 4 && std::isfinite(x) && std::isfinite(y) && std::isfinite(angle))
        if (auto *b = find(id)) {
            b->p = {std::clamp(x, 0.0F, 1400.0F), std::clamp(y, 0.0F, 840.0F)};
            b->angle = angle;
            b->v = {};
            b->angular = 0;
        }
}
void body_velocity(int id, float vx, float vy, float angular) {
    if (std::isfinite(vx) && std::isfinite(vy) && std::isfinite(angular))
        if (auto *b = find(id)) {
            b->v = {vx, vy};
            b->angular = angular;
        }
}
int body_pick(float x, float y) {
    for (auto i = bodies.rbegin(); i != bodies.rend(); ++i)
        if (i->id >= 4 &&
            (i->shape == 0 ? length(Vec{x, y} - i->p) <= i->w / 2 : inside({x, y}, *i)))
            return i->id;
    return -1;
}
void world_gravity(float x, float y) {
    if (std::isfinite(x) && std::isfinite(y))
        gravity = {std::clamp(x, -2000.0F, 2000.0F), std::clamp(y, -2000.0F, 2000.0F)};
}
void world_material(float bounce, float drag) {
    if (std::isfinite(bounce) && std::isfinite(drag)) {
        restitution = std::clamp(bounce, 0.0F, 1.0F);
        friction = std::clamp(drag, 0.0F, 1.0F);
    }
}
void world_step(float dt) {
    if (!std::isfinite(dt) || dt <= 0 || dt > .025F)
        return;
    for (auto &b : bodies)
        if (b.im > 0) {
            b.v = b.v + gravity * dt;
            b.v.x = std::clamp(b.v.x * .9998F, -2400.0F, 2400.0F);
            b.v.y = std::clamp(b.v.y * .9998F, -2400.0F, 2400.0F);
            b.angular = std::clamp(b.angular * .998F, -35.0F, 35.0F);
            b.p = b.p + b.v * dt;
            b.angle = std::remainder(b.angle + b.angular * dt, 6.283185307F);
        }
    for (auto &bucket : grid)
        bucket.clear();
    for (size_t index = 0; index < bodies.size(); ++index) {
        const auto &b = bodies[index];
        float ex = b.shape == 0 ? b.w / 2 : extent(b, {1, 0}),
              ey = b.shape == 0 ? b.w / 2 : extent(b, {0, 1});
        // Clamp before converting to integers, including bodies outside the world.
        int x0 = static_cast<int>(
                std::clamp(std::floor((b.p.x - ex) / cell), 0.0F, float(columns - 1))),
            x1 = static_cast<int>(
                std::clamp(std::floor((b.p.x + ex) / cell), 0.0F, float(columns - 1)));
        int y0 = static_cast<int>(
                std::clamp(std::floor((b.p.y - ey) / cell), 0.0F, float(rows - 1))),
            y1 = static_cast<int>(
                std::clamp(std::floor((b.p.y + ey) / cell), 0.0F, float(rows - 1)));
        for (int y = y0; y <= y1; ++y)
            for (int x = x0; x <= x1; ++x)
                grid[static_cast<size_t>(y * columns + x)].push_back(static_cast<int>(index));
    }
    seen.fill(0);
    contacts.clear();
    candidateCount = 0;
    for (const auto &bucket : grid)
        for (size_t i = 0; i < bucket.size(); ++i)
            for (size_t j = i + 1; j < bucket.size(); ++j) {
                int ai = bucket[i], bi = bucket[j];
                const auto &a = bodies[static_cast<size_t>(ai)];
                const auto &b = bodies[static_cast<size_t>(bi)];
                if (a.im + b.im == 0)
                    continue;
                size_t key = static_cast<size_t>(ai * capacity + bi);
                if (seen[key])
                    continue;
                seen[key] = 1;
                ++candidateCount;
                Contact c{};
                c.a = ai;
                c.b = bi;
                if (collide(a, b, c))
                    contacts.push_back(c);
            }
    for (int iteration = 0; iteration < 10; ++iteration)
        for (auto &c : contacts)
            solve(c);
    for (const auto &c : contacts) {
        auto &a = bodies[static_cast<size_t>(c.a)];
        auto &b = bodies[static_cast<size_t>(c.b)];
        Vec correction = c.normal * (std::max(c.depth - .15F, 0.0F) * .65F / (a.im + b.im));
        a.p = a.p - correction * a.im;
        b.p = b.p + correction * b.im;
    }
}
int world_count() { return static_cast<int>(bodies.size()); }
int world_contacts() { return static_cast<int>(contacts.size()); }
int world_candidates() { return candidateCount; }
float *world_data() {
    for (size_t i = 0; i < bodies.size(); ++i) {
        const auto &b = bodies[i];
        size_t p = i * 12;
        output[p] = static_cast<float>(b.id);
        output[p + 1] = static_cast<float>(b.shape);
        output[p + 2] = b.p.x;
        output[p + 3] = b.p.y;
        output[p + 4] = b.w;
        output[p + 5] = b.h;
        output[p + 6] = b.angle;
        output[p + 7] = b.v.x;
        output[p + 8] = b.v.y;
        output[p + 9] = b.im == 0 ? 1.0F : 0.0F;
        output[p + 10] = b.angular;
        output[p + 11] = 0;
    }
    return output.data();
}
}
