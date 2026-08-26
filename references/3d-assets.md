# 3D 素材整合知识库

服务 `3d_asset_integration` 模块：Cosplay 合成中**置入 3D 素材**（模型/道具/武器/翅膀等）的**质感修正与真实融合**——把"低质量 3D 拼贴物"提升为"与实拍环境完全融合的高质量真实物体"。已学习自用户预设《3D模型优化》。

## 触发词

3D素材 / 道具模型 / 置入模型 / 武器融合 / 3D合成 / 素材质感修正 / 模型太假 / 素材悬浮

## 至高红线（防护性锁定）

- 只修改**置入的 3D 素材本体**及其极窄交互边缘，严禁污染全图
- 严禁通过**全局调色/压光/改对比/改色温**掩盖问题（这是掩盖，不是修复）
- 严禁改变原图人物、背景、镜头透视、全局光影
- 素材必须**还是它自己**——只能提升真实度，不能改变设计身份/轮廓语义

## 8 个控制模块（对应参数滑块）

| 模块 | 作用 | 关键措辞 |
|---|---|---|
| `mesh_density_upgrade` 面数提升 | 消除低模折线感，曲面连续 | 0.5-0.8 优化曲面过渡/圆角；>0.8 平顺化所有低模折角，但保留硬边机械件造型 |
| `normal_to_real_relief` 假法线转真实凹凸 | 假法线/贴图明暗→真实几何起伏 | 边缘/刻线/接缝/压印获得真实表面转折、微阴影、厚度感 |
| `translucent_sss_rebuild` SSS 次表面散射 | 可透光材质（皮肤/蜡/树脂/玉石）重建透光 | 仅对可透光材质生效；受光面内部颜色扩散、背光薄边透亮、厚处闷薄处透 |
| `local_light_matching` 光线匹配 | 素材本体受光/反光/AO/接触阴影 | 按原图主光/辅光/环境反射重建素材明暗，不动全局 |
| `hsl_matching` HSL 匹配 | 素材色相饱和度贴近环境 | 局部微调；保留固有色，不许把红的调成紫、银的调成脏绿 |
| `contact_and_interaction_matching` 接触交互 | 边缘/接触面/落地/遮挡关系 | 消除硬切边/白边/黑边/悬浮感；补接触 AO、边缘软化、地面接触压暗 |
| `material_detail_upgrade` 材质精度 | 表面细节/微观纹理/粗糙度层次 | 金属细腻划痕、布料纤维编织、石材微裂颗粒、塑料树脂表面变化 |
| `frame_lock_strength` 框架锁定 | 锁定素材轮廓/设计身份 | >0.8 高强度锁定：只允许修表面/边缘/光线，不允许改型 |

## 融合校验红线

- `local_only`：所有修正局部发生，至高原则
- `no_global_grade`：严禁全局调色压光掩盖问题
- `asset_identity_preserved`：素材还是它自己，只是更真实
- `real_contact`：接触面/遮挡/AO/边缘过渡必须可信
- `no_fake_detail`：细节提升像真实材质细化，不乱加噪点划痕

## 输出示例（Nano Banana 信封 content 片段）

```json
"3d_asset_integration": {
  "target": "置入的3D素材本体及其交互边缘",
  "locks": "只修改素材本体；禁止全局调色/压光；保持素材设计身份",
  "modules": {
    "mesh_density_upgrade": 0.72,
    "normal_to_real_relief": 0.76,
    "translucent_sss_rebuild": 0.0,
    "local_light_matching": 0.88,
    "hsl_matching": 0.64,
    "contact_and_interaction_matching": 0.90,
    "material_detail_upgrade": 0.78,
    "frame_lock_strength": 0.94
  }
}
```

## 使用说明

- 用户提到 3D 素材相关 → 启用 `3d_asset_integration` 模块（按需取用 8 个子模块，不相关的可不列）
- 修脸/修容等其他人像处理不受影响，`3d_asset_integration` 只处理置入素材
- 该模块同样遵守透视/光影一致性与保底规则
